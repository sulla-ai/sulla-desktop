// Graph - LangGraph-style workflow orchestrator
// sits on the backend and processes the graphs

import type { AbortService } from '../services/AbortService';
import { throwIfAborted } from '../services/AbortService';
import { getWebSocketClientService } from '../services/WebSocketClientService';
import type { ChatMessage } from '../languagemodels/BaseLanguageModel';
import { AgentPlanInterface } from '../database/models/AgentPlan';
import { AgentPlanTodoInterface } from '../database/models/AgentPlanTodo';
import { SullaSettingsModel } from '../database/models/SullaSettingsModel';
import { BaseNode } from './BaseNode';
import { 
  StrategicPlannerNode, 
  TacticalPlannerNode, 
  TacticalExecutorNode, 
  TacticalCriticNode, 
  StrategicCriticNode, 
  SummaryNode,
  OverLordPlannerNode,
  MemoryNode,
  SimpleNode,
  InputHandlerNode,
  PlanRetrievalNode
} from './index';
import { PlannerNode } from './PlannerNode';
import { ReasoningNode } from './ReasoningNode';
import { ActionNode } from './ActionNode';
import { SkillCriticNode } from './SkillCriticNode';
import { OutputNode } from './OutputNode';

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

// SkillGraph retry configuration
const MAX_PLANNER_RETRIES = 2; // Total attempts: 3 (0, 1, 2)
const MAX_REASONING_RETRIES = 2; // Total attempts: 3 (0, 1, 2)

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

const DEFAULT_WS_CHANNEL = 'dreaming-protocol';
const MAX_CONSECTUIVE_LOOP = 20;
const MAX_MESSAGES_IN_THREAD = 120;

const DEFAULT_MAX_ITERATIONS = 10;
const DEFAULT_MAX_REVISION_COUNT = 3;
// ============================================================================
// THREAD STATE INTERFACES
// ============================================================================

/**
 * SkillGraph-specific thread state interface
 * Extends BaseThreadState with SkillGraph-specific metadata properties
 */
export interface SkillGraphState extends BaseThreadState {
  metadata: BaseThreadState['metadata'] & {
    planRetrieval?: {
      intent: string;
      goal: string;
      response_immediate: boolean;
      skillData?: {
        title: string;
        excerpt: string;
        document: string;
      };
    };
    planner?: {
      goal: string;
      skill_focused: boolean;
      plan_steps: string[];
      complexity_assessment?: string;
    };
    reasoning?: {
      currentDecision?: {
        current_situation: string;
        goal_progress: string;
        next_action: string;
        action_type: 'continue' | 'complete' | 'verify_evidence';
        reasoning: string;
        confidence: number;
        stop_condition_met: boolean;
        skill_progress?: {
          current_step: number;
          total_steps: number;
          evidence_required: string;
          task_verification?: {
            verification_method: string;
            expected_outcome: string;
          };
        };
      };
    };
    actions?: Array<{
      success: boolean;
      result: any;
      evidence_collected?: Array<{
        evidence_type: string;
        description: string;
        evidence_pointer?: string;
        verification_method: string;
      }>;
      completion_justification?: string;
    }>;
    skillCritic?: {
      decision: 'continue' | 'revise' | 'complete';
      reason: string;
      progressScore: number;
      evidenceScore: number;
      nextAction?: string;
      completionJustification?: string;
      evaluatedAt: number;
    };
    output?: {
      taskStatus: 'completed' | 'partial' | 'failed';
      completionScore: number;
      skillCompliance: number;
      summaryMessage: string;
      accomplishments: string[];
      evidenceHighlights: string[];
      nextSteps: string[];
      skillFeedback: string;
      generatedAt: number;
      cycleCount: number;
      actionCount: number;
      evidenceCount: number;
    };
    reactLoopCount?: number;
  };
}

/**
 * Generic node interface for any graph execution.
 * Nodes MUST ONLY write facts/verdicts to state — no routing decisions.
 * @template TState - Specific state shape (HierarchicalThreadState, KnowledgeThreadState, etc.)
 */
export interface GraphNode<TState> {
  /** Unique node identifier (must be graph-unique, e.g. 'tactical_executor') */
  id: string;

  /** Human-readable name for logs/debug */
  name: string;

  /**
   * Core execution logic.
   * - Perform work (plan, execute, critique, write, etc.)
   * - Mutate state.metadata with results/facts only
   * - Return neutral decision (graph edges handle real next node)
   */
  execute(state: TState): Promise<NodeResult<TState>>;

  /** Optional: one-time setup (LLM init, tool registration, etc.) */
  initialize?(): Promise<void>;

  /** Optional: cleanup on graph destroy */
  destroy?(): Promise<void>;
}

/**
 * Minimal result type every node must return.
 * Keeps routing out of nodes — edges interpret state facts.
 */
export interface NodeResult<TState> {
  state: TState;                  // mutated/updated state
  decision: NodeDecision;         // neutral signal only
}

// NodeResult must always be one of:
type NodeDecision =
  | { type: 'end' }
  | { type: 'goto', nodeId: string }
  | { type: 'continue' }           // same node, more work
  | { type: 'next' }               // follow static/conditional edge
  | { type: 'revise' }             // go back to planner/critic

export interface GraphEdge<TState> {
  from: string;
  to: string | ((state: TState) => string | null);
}

// Base shared across all thread states
export interface BaseThreadState {
  messages: ChatMessage[];

  // for simple node
  prompt?: string;

  // Tools found by browse_tools calls (accumulates across multiple calls)
  foundTools?: any[];

  metadata: {
    action: 'direct_answer' | 'ask_clarification' | 'use_tools' | 'create_plan' | 'run_again';
    threadId: string;
    wsChannel: string;

    reasoning?: string;

    llmModel: string;
    llmLocal: boolean;

    cycleComplete: boolean;
    waitingForUser: boolean;

    options: {
      abort?: AbortService;
    };

    currentNodeId: string;
    consecutiveSameNode: number;
    iterations: number;
    revisionCount: number;
    maxIterationsReached: boolean;

    memory: {
      knowledgeBaseContext: string;
      chatSummariesContext: string;
    };

    // Plan retrieval data from PlanRetrievalNode - minimal metadata only
    // Skills and memories are now added to message thread via tool results
    planRetrieval?: {
      intent: string;
      goal: string;
      response_immediate: boolean;
    };

    // any graph could technically call another graph, this is the format
    subGraph: {
      state: 'trigger_subgraph' | 'running' | 'completed' | 'failed';
      name: 'hierarchical' | 'knowledge';
      prompt: string;
      response: string;
    };

    finalSummary: string;
    totalSummary?: string;
    finalState: 'failed'  | 'running' | 'completed';

    // parent graph return
    returnTo: string | null;

    awarenessIncluded?: boolean;
    datetimeIncluded?: boolean;
    hadToolCalls?: boolean;
    hadUserMessages?: boolean;
  };
}

export interface KnowledgeThreadState extends BaseThreadState {
  messages: ChatMessage[];

  metadata: BaseThreadState['metadata'] & {
    // Core context
    kbArticleId?: string;
    kbTopic: string;
    kbGoal: string;

    // Structured article metadata (collected/refined during process)
    kbArticleSchema: {
      schemaversion?: string;       // e.g. "1.0"
      section?: string;
      category?: string;
      slug?: string;
      title?: string;
      tags?: string[];
      order?: number;
      locked?: boolean;             // default false
      author?: string;
      related_slugs?: string[];
      mentions?: string[];
      related_entities?: any[];
    };

    // Full serialized article data (JSON string or object)
    // Use this for rich/complex data that doesn't fit schema (content blocks, sections, frontmatter)
    kbFinalContent?: string;        // final markdown / rendered text
    kbStatus: 'draft' | 'reviewed' | 'published' | 'failed';

    // Planning
    kbCurrentSteps: Array<{
      description: string;
      done: boolean;
      resultSummary?: string;
      completedAt?: string;
    }>;

    kbActiveStepIndex: number;

    // Critic
    kbCriticVerdict?: {
      status: 'approve' | 'revise' | 'continue';
      reason?: string;
      at: number;
    };
  };
}

export interface HierarchicalThreadState extends BaseThreadState {
  messages: ChatMessage[];

  metadata: BaseThreadState['metadata'] & {
    // Strategic
    plan: {
      model?: AgentPlanInterface;
      milestones?: Array<{ 
        model?: AgentPlanTodoInterface,
      }>;
      activeMilestoneIndex: number;
      allMilestonesComplete: boolean;
    };

    // Tactical (current milestone only)
    currentSteps: Array<{
      id: string;
      action: string;
      description: string;
      done: boolean;
      resultSummary?: string;
      toolHints?: string[];
    }>;
    activeStepIndex: number;

    // Critic verdicts
    tacticalCriticVerdict?: {
      status: 'approve' | 'revise' | 'escalate';
      reason?: string;
      at: number;
    };
    strategicCriticVerdict?: {
      status: 'approve' | 'revise';
      confidence?: number;
      reason?: string;
      suggestions?: string;
      triggerKnowledgeBase?: boolean;
      killSwitch?: boolean;
      at: number;
    };

  };
}

export interface OverlordThreadState extends BaseThreadState {
  messages: ChatMessage[];
  metadata: BaseThreadState['metadata'] & {

    // This is what the Overlord is going to be working on as it calls
    // other subgraphs
    primaryProject: string;
    projectDescription: string;
    projectGoals: string[];
    projectState: 'continue' | 'end';

  };
}

// ============================================================================
//
// Graph Class
//
//
//
// ============================================================================

/**
 * Generic Graph engine for hierarchical agent execution.
 * 
 * Supports any state shape via generics (TState).
 * - Nodes write facts/verdicts only
 * - Edges own all routing/advancement logic
 * - Handles abort, loop safety, WS completion signal
 * - Works standalone or as sub-graph (with returnTo flag)
 * 
 * Usage:
 *   const graph = new Graph<ThreadState>();
 *   graph.addNode(new StrategicPlannerNode());
 *   graph.addConditionalEdge('strategic_planner', state => 
 *     state.metadata.plan?.milestones?.length ? 'tactical_planner' : 'end'
 *   );
 *   const finalState = await graph.execute(initialState);
 * 
 * @template TState - State interface (ThreadState, KnowledgeThreadState, etc.)
 */
export class Graph<TState = HierarchicalThreadState> {
  private nodes: Map<string, GraphNode<TState>> = new Map();
  private edges: Map<string, GraphEdge<TState>[]> = new Map();
  private entryPoint: string | null = null;
  private endPoints: Set<string> = new Set();
  private initialized = false;

  /**
   * Add a node to the graph.
   * @param node - Node instance implementing GraphNode<TState>
   * @returns this for chaining
   */
  addNode(node: GraphNode<TState>): this {
    this.nodes.set(node.id, node);
    return this;
  }

  /**
   * Add a static or conditional edge.
   * @param from - Starting node ID
   * @param to - Target node ID or conditional function (state => nextId | null)
   * @returns this for chaining
   */
  addEdge(
    from: string,
    to: string | ((state: TState) => string | null)
  ): this {
    const list = this.edges.get(from) || [];
    list.push({ from, to });
    this.edges.set(from, list);
    return this;
  }

  /**
   * Convenience alias for conditional edges.
   * @param from - Starting node ID
   * @param condition - Function returning next node ID or null
   * @returns this for chaining
   */
  addConditionalEdge(
    from: string,
    condition: (state: TState) => string | null
  ): this {
    return this.addEdge(from, condition);
  }

  /**
   * Set the starting node.
   * @param nodeId - Node ID to begin execution
   * @returns this for chaining
   */
  setEntryPoint(nodeId: string): this {
    this.entryPoint = nodeId;
    return this;
  }

  /**
   * Mark nodes as valid termination points.
   * @param nodeIds - Node IDs where execution can end
   * @returns this for chaining
   */
  setEndPoints(...nodeIds: string[]): this {
    nodeIds.forEach(id => this.endPoints.add(id));
    return this;
  }

  /**
   * Initialize all nodes (call initialize() if present).
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    for (const node of this.nodes.values()) {
      if (node.initialize) await node.initialize();
    }
    this.initialized = true;
  }

  /**
   * Get node by ID for testing and validation purposes
   * @param nodeId - The node identifier
   * @returns The node instance or undefined if not found
   */
  getNode(nodeId: string): GraphNode<TState> | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get all node IDs for validation purposes
   * @returns Array of all registered node IDs
   */
  getNodeIds(): string[] {
    return Array.from(this.nodes.keys());
  }

  /**
   * Execute the graph from entry point until end or max iterations.
   * 
   * @param initialState - Starting state (TState)
   * @param maxIterations - Safety limit (default 1M)
   * @param options - Optional abort controller
   * @returns Final state after execution
   */
  async execute(
    initialState: TState,
    entryPointNodeId?: string,
    options?: { maxIterations: number }
  ): Promise<TState> {
    if (!this.entryPoint) throw new Error('No entry point');

    await this.initialize();

    let state = initialState;
    (state as any).metadata.currentNodeId = entryPointNodeId || this.entryPoint;

    console.log(`[Graph] Start from ${(state as any).metadata.currentNodeId}`);

    (state as any).metadata.iterations ??= 0;
    (state as any).metadata.consecutiveSameNode ??= 0;

    const maxIterations = options?.maxIterations ?? 1000000;

    try {
      while ((state as any).metadata.iterations < maxIterations) {
        (state as any).metadata.iterations++;
        
        throwIfAborted(state, 'Graph execution aborted');

        if ((state as any).metadata.waitingForUser && (state as any).metadata.currentNodeId === 'context_trimmer') {
          console.log('[Graph] Waiting for user at context_trimmer → forcing end');
          break;
        }

        const node = this.nodes.get((state as any).metadata.currentNodeId);
        if (!node) throw new Error(`Node missing: ${(state as any).metadata.currentNodeId}`);

        console.log(`[Graph] → ${node.name} (${(state as any).metadata.currentNodeId})`);
        const result: NodeResult<TState> = await node.execute(state);

        state = result.state;

        // Check abort immediately after node execution
        throwIfAborted(state, 'Graph execution aborted');

        // yield to event loop
        await new Promise(r => setTimeout(r, 0));

        const nextId = this.resolveNext((state as any).metadata.currentNodeId, result.decision, state);
        console.log(`[Graph] ${result.decision.type} → ${nextId}`);

        if (nextId === (state as any).metadata.currentNodeId) {
          (state as any).metadata.consecutiveSameNode++;
          if ((state as any).metadata.consecutiveSameNode >= MAX_CONSECTUIVE_LOOP) {
            console.warn(`Max consecutive loop — forcing end`);
            break;
          }
        } else {
          (state as any).metadata.consecutiveSameNode = 0;
        }

        if (nextId === 'end' || (this.endPoints.has((state as any).metadata.currentNodeId) && result.decision.type === 'end')) {
          console.log(`[Graph] Complete after ${(state as any).metadata.iterations} iterations`);
          break;
        }

        (state as any).metadata.currentNodeId = nextId;
      }
    } catch (error: any) {
      console.log('[Graph] Execution stopped:', error);
      // Don't re-throw AbortError, just log and continue to send completion signal
      if (error?.name === 'AbortError') {
        console.log('[Graph] Graph execution aborted by user');
      } else {
        // Re-throw non-abort errors
        throw error;
      }
    }

    if ((state as any).metadata.iterations >= maxIterations) {
      console.warn('Max iterations hit');
      (state as any).metadata.maxIterationsReached = true;
    }

    // Always send completion signal, whether completed naturally or aborted
    console.log('[Graph] Sending graph_execution_complete signal');
    const ws = getWebSocketClientService();
    const connId = (state as any).metadata.wsChannel || 'dreaming-protocol';
    ws.send(connId, {
      type: 'transfer_data',
      data: { role: 'system', content: 'graph_execution_complete' },
    });

    return state;
  }

  /**
   * Resolve next node based on decision and edges.
   * @param current - Current node ID
   * @param decision - Node's returned decision
   * @param state - Current state
   * @returns Next node ID or 'end'
   */
  private resolveNext(current: string, decision: NodeDecision, state: TState): string {
    console.log(`[Graph] resolveNext: current=${current}, decision=${decision.type}`);
    
    switch (decision.type) {
      case 'end': return 'end';
      case 'goto':
        if (this.nodes.has(decision.nodeId)) return decision.nodeId;
        console.warn(`Invalid goto: ${decision.nodeId}`);
        return 'end';
      case 'continue': return current;
      case 'revise':
        return this.getReviserFor(current) || 'end';
      case 'next':
        const edges = this.edges.get(current) || [];
        console.log(`[Graph] resolveNext: found ${edges.length} edges for ${current}`);
        for (const edge of edges) {
          if (typeof edge.to === 'function') {
            const nextId = edge.to(state);
            console.log(`[Graph] resolveNext: conditional edge resolved to ${nextId}`);
            if (nextId && this.nodes.has(nextId)) return nextId;
          } else if (this.nodes.has(edge.to)) {
            console.log(`[Graph] resolveNext: static edge to ${edge.to}`);
            return edge.to;
          }
        }
        console.log(`[Graph] resolveNext: no valid edges found, ending`);
        return 'end';
    }
  }

  /**
   * Get reviser node for revise decisions (stub - customize per graph).
   */
  private getReviserFor(nodeId: string): string | null {
    if (nodeId.includes('executor')) return 'planner';
    if (nodeId.includes('critic') || nodeId.includes('planner')) return 'strategic_planner';
    return null;
  }

  /**
   * Clean up all nodes.
   */
  async destroy(): Promise<void> {
    for (const node of this.nodes.values()) {
      if (node.destroy) await node.destroy();
    }
    this.nodes.clear();
    this.edges.clear();
    this.initialized = false;
  }
}

/**
 * Async node that executes the requested sub-graph when triggered by OverLord.
 * Pulls subGraphName + subGraphPrompt from metadata.
 * Builds minimal sub-state, runs sub-graph, merges results back.
 * Returns control to overlord_planner.
 */
export class SubgraphTriggerNode implements GraphNode<OverlordThreadState> {
  id = 'subgraph_trigger';
  name = 'Subgraph Trigger';

  async execute(state: OverlordThreadState): Promise<NodeResult<OverlordThreadState>> {
    const v = state.metadata.subGraph;

    if (v?.state !== 'trigger_subgraph' || !v.name) {
      console.warn('No valid sub-graph trigger');
      return { state, decision: { type: 'next' } };
    }

    const subName = v.name;
    const prompt = v.prompt || '';

    let subGraph: Graph<any> | null = null;
    let subState: any = null;

    switch (subName) {
      case 'hierarchical':
        subGraph = createHierarchicalGraph();
        subState = await createInitialThreadState<HierarchicalThreadState>(
          prompt,
          {
            wsChannel: state.metadata.wsChannel,
            llmModel: state.metadata.llmModel,
            options: state.metadata.options
          }
        );
        break;

      case 'knowledge':
        subGraph = await createKnowledgeGraph();
        subState = await createInitialThreadState<KnowledgeThreadState>(
          prompt,
          {
            wsChannel: state.metadata.wsChannel,
            llmModel: state.metadata.llmModel,
            options: state.metadata.options,
            currentNodeId: 'knowledge_planner'  // KB entry point
          }
        );
        break;

      default:
        console.warn(`Unsupported sub-graph: ${subName}`);
        return { state, decision: { type: 'next' } };
    }
      
    if (!subGraph || !subState) {
      console.error(`Failed to initialize sub-graph: ${subName}`);
      return { state, decision: { type: 'next' } };
    }

    // Trigger the subGraph with the Initial subState
    const subResult = await subGraph.execute(subState);

    // Merge back to original calling graph
    state.metadata.subGraph.state = subResult.metadata.finalState;
    state.metadata.subGraph.response = subResult.metadata.finalSummary;

    // Reset trigger
    state.metadata.subGraph.prompt = '';

    return { state, decision: { type: 'next' } };
  }
}

/**
 * Create initial thread state with first user message.
 * @param prompt - The initial user message content
 * @param metadata - Optional metadata for the message
 * @returns Fully initialized ThreadState
 */
export async function createInitialThreadState<T extends BaseThreadState>(
  prompt: string,
  overrides: Partial<T['metadata']> = {}
): Promise<T> {

  const now = Date.now();
  const msgId = nextMessageId();
  
  const mode = await SullaSettingsModel.get('modelMode', 'local');
  const llmModel = mode === 'remote' ? await SullaSettingsModel.get('remoteModel', 'grok-4-1-fast-reasoning') : await SullaSettingsModel.get('sullaModel', 'tinyllama:latest');
  const llmLocal = mode === 'local';
  
  const baseMetadata: BaseThreadState['metadata'] = {
      action: 'direct_answer',  // Default action for initial state
      threadId: overrides.threadId ?? nextThreadId(),
      wsChannel: overrides.wsChannel ?? DEFAULT_WS_CHANNEL,
      llmModel,
      llmLocal,
      cycleComplete: false,
      waitingForUser: false,
      options: overrides.options ?? { abort: undefined },
      currentNodeId: overrides.currentNodeId ?? 'context_trimmer',
      consecutiveSameNode: 0,
      iterations: 0,
      revisionCount: 0,
      maxIterationsReached: false,
      memory: overrides.memory ?? {
        knowledgeBaseContext: '',
        chatSummariesContext: ''
      },
      subGraph: {
        state: 'completed',
        name: 'hierarchical',
        prompt: '',
        response: ''
      },
      finalSummary: '',
      totalSummary: '',
      finalState: 'running',
      returnTo: null
    };

  const result = {
      messages: [{
        id: msgId,
        role: 'user',
        content: prompt.trim(),
        timestamp: now,
        metadata: {
          type: 'initial_prompt',
          source: 'user'
        }
      }],
      metadata: {
        ...baseMetadata,
        ...overrides
      }
    };

  return result as unknown as T;
}

let messageCounter = 0;
let threadCounter = 0;

export function nextMessageId(): string {
  return `msg_${Date.now()}_${++messageCounter}`;
}

export function nextThreadId(): string {
  return `thread_${Date.now()}_${++threadCounter}`;
}

export class ContextTrimmerNode<TState extends BaseThreadState = HierarchicalThreadState> extends BaseNode {
  constructor() {
    super('context_trimmer', 'Context Trimmer');
  }

  async execute(state: TState): Promise<NodeResult<TState>> {
    if (state.messages.length > MAX_MESSAGES_IN_THREAD) {
      state.messages = state.messages.slice(-MAX_MESSAGES_IN_THREAD);
      console.log(`[ContextTrimmer] Trimmed to last ${MAX_MESSAGES_IN_THREAD} messages`);
    }
    return { state, decision: { type: 'next' } };
  }
}


// ============================================================================
//
// Graph Decision Trees
//
//
//
// ============================================================================

/**
 * Creates a standalone micro-graph for Knowledge Base article creation.
 * 
 * This sub-graph runs independently or can be deferred to from primary graphs.
 * Flow:
 *   kb_planner → kb_executor (loops) → kb_critic → (revise → planner) or (approve → kb_writer) → end
 * 
 * Usage:
 *   - Standalone: await kbGraph.execute(state);
 *   - Deferred: trigger from strategic_planner via conditional edge
 *     if (milestone.generateKnowledgeBase) return 'kb_planner'
 *   - Return: kb_writer routes back via metadata.returnTo or clears sub-graph flag
 * 
 * State fields used (prefixed to avoid collision):
 *   - kbCurrentSteps: Array<{description: string, done: boolean, resultSummary?: string}>
 *   - kbActiveStepIndex: number
 *   - kbCriticVerdict: {status: 'approve'|'revise', reason?: string, at: number}
 * 
 * @returns {Graph} Fully configured knowledge base creation graph
 */
export async function createKnowledgeGraph(): Promise<Graph<KnowledgeThreadState>> {
  const {
    MemoryNode,
    KnowledgePlannerNode,
    KnowledgeExecutorNode,
    KnowledgeCriticNode,
    KnowledgeWriterNode,
    SummaryNode
  } = await import('.');

  const graph = new Graph<KnowledgeThreadState>();

  graph.addNode(new MemoryNode() as any);
  graph.addNode(new KnowledgePlannerNode());   // id: 'knowledge_planner'
  graph.addNode(new KnowledgeExecutorNode());  // id: 'knowledge_executor'
  graph.addNode(new KnowledgeCriticNode());    // id: 'knowledge_critic'
  graph.addNode(new KnowledgeWriterNode());    // id: 'knowledge_writer'
  graph.addNode(new SummaryNode() as any);

  // Planner always starts executor
  graph.addEdge('memory_recall', 'knowledge_planner');
  graph.addEdge('knowledge_planner', 'knowledge_executor');

  // Executor loops until steps complete
  graph.addConditionalEdge('knowledge_executor', state =>
    state.metadata.kbActiveStepIndex < (state.metadata.kbCurrentSteps?.length ?? 0) - 1
      ? 'knowledge_executor'
      : 'knowledge_critic'
  );

  // Critic decides: escelate, done, or approve(continue)
  graph.addConditionalEdge('knowledge_critic', state => {
    const v = state.metadata.kbCriticVerdict?.status;
    const steps = state.metadata.kbCurrentSteps ?? [];
    const idx = state.metadata.kbActiveStepIndex;
    const schema = state.metadata.kbArticleSchema;
    const hasContent = !!state.metadata.kbFinalContent?.trim();

    // Required schema check
    const schemaIncomplete = !schema.title?.trim() ||
                            !schema.slug?.trim() ||
                            !schema.tags?.length ||
                            !schema.author?.trim();

    // All steps complete?
    const allStepsDone = steps.length > 0 && steps.every(s => s.done);

    if (v === 'revise') {
      // Major issues → replan
      return 'knowledge_planner';
    }

    if (v === 'continue' || !allStepsDone || idx < steps.length - 1 || schemaIncomplete || !hasContent) {
      // More work needed (steps left, schema gaps, no content)
      return 'knowledge_executor';
    }

    // Approve: everything ready
    if (allStepsDone && !schemaIncomplete && hasContent) {
      state.metadata.kbStatus = 'reviewed';
      return 'knowledge_writer';
    }

    // Fallback safety: incomplete but not explicit revise → replan
    return 'knowledge_planner';
  });

  // Writer finishes article → end (or return to caller if sub-graph)
  graph.addConditionalEdge('knowledge_writer', state => {
    if (state.metadata.returnTo) {
      const returnNode = state.metadata.returnTo;
      state.metadata.returnTo = null;
      return returnNode;
    }
    return 'end';
  });

  graph.setEntryPoint('knowledge_planner');
  graph.setEndPoints('knowledge_writer');

  return graph;
}

/**
 * Create the hierarchical planning graph
 * Flow: Memory → StrategicPlanner → [TacticalPlanner → Executor → Critic] → FinalCritic
 * 
 * Strategic Planner: Creates high-level goals and milestones (persisted to DB)
 * Tactical Planner: Creates micro-plans for each milestone (state-only)
 * Executor: Executes tactical steps with tools
 * Critic: Reviews tactical step execution, can request revision or advance
 */
export function createHierarchicalGraph(): Graph<HierarchicalThreadState> {

  const graph = new Graph<HierarchicalThreadState>();

  // Add nodes
  graph.addNode(new ContextTrimmerNode<HierarchicalThreadState>());
  graph.addNode(new StrategicPlannerNode());
  graph.addNode(new TacticalPlannerNode());
  graph.addNode(new TacticalExecutorNode());
  graph.addNode(new TacticalCriticNode());
  graph.addNode(new StrategicCriticNode());
  graph.addNode(new SummaryNode<HierarchicalThreadState>());

  graph.addEdge('context_trimmer', 'strategic_planner');

  // Conditional: StrategicPlanner → end (simple) or TacticalPlanner (complex)
  graph.addConditionalEdge('strategic_planner', state => {
    const hasPlan = !!state.metadata.plan?.model;
    const hasMilestones = !!state.metadata.plan?.milestones?.length;

    if (!hasPlan || !hasMilestones) {
      return 'strategic_planner';
    }

    // Force tactical_planner even if activeMilestoneIndex is unset
    state.metadata.plan.activeMilestoneIndex ??= 0;
    return 'strategic_planner';
  });

  graph.addConditionalEdge('tactical_planner', state => {
    const steps = state.metadata.currentSteps ?? [];
    if (steps.length === 0) {
      // No steps → milestone complete → check if all milestones done
      return state.metadata.plan?.allMilestonesComplete
        ? 'strategic_critic'
        : 'tactical_planner';  // ← loop back to plan next milestone
    }
    return 'tactical_executor';
  });

  // Conditional edge from tactical_executor
  graph.addConditionalEdge('tactical_executor', state => {
    const steps = state.metadata.currentSteps ?? [];
    const idx = state.metadata.activeStepIndex ?? 0;

    // Safety: invalid state
    if (idx >= steps.length || !steps[idx]) {
      return 'tactical_critic'; // or 'summary'
    }

    const currentStep = steps[idx];

    // Step not yet marked done → stay here (more tool calls needed)
    if (!currentStep.done) {
      return 'tactical_executor'; // continue same step
    }

    // Step done, but more steps remain → advance & continue executor
    if (idx + 1 < steps.length) {
      // activeStepIndex already incremented in node
      return 'tactical_executor';
    }

    // All steps for this milestone done → go to critic
    return 'tactical_critic';
  });

  // Conditional: TacticalCritic → revise to TacticalPlanner, approve: to TacticalExecutor (more steps) or StrategicCritic
  graph.addConditionalEdge('tactical_critic', state => {
    const v = state.metadata.tacticalCriticVerdict?.status;
    const idx = state.metadata.activeStepIndex;
    const steps = state.metadata.currentSteps ?? [];

    if (v === 'revise') return 'tactical_executor';

    if (v === 'escalate') return 'strategic_planner';

    // approve: mark current step done + advance
    if (steps[idx]) {
      steps[idx].done = true;
    }

    // Mark current step done (already there)
    if (steps[idx]) steps[idx].done = true;

    // Advance step index
    state.metadata.activeStepIndex = idx + 1;

    if (state.metadata.activeStepIndex < steps.length) {
      return 'tactical_executor'; // more steps in current milestone
    }

    // Milestone complete → advance milestone index
    const plan = state.metadata.plan;
    if (plan) {
      plan.activeMilestoneIndex = (plan.activeMilestoneIndex ?? 0) + 1;
      plan.allMilestonesComplete = 
        plan.activeMilestoneIndex >= (plan.milestones?.length ?? 0);

      // Reset tactical steps for next milestone
      state.metadata.currentSteps = [];
      state.metadata.activeStepIndex = 0;
    }

    // Always go back to tactical_planner to handle next milestone
    return 'tactical_planner';
  });

  // Strategic Critic edge — now handles approve/revise/kill-switch fully
  graph.addConditionalEdge('strategic_critic', state => {
    const verdict = state.metadata.strategicCriticVerdict;

    if (!verdict) {
      console.warn('[Graph] No strategicCriticVerdict — fallback to summary');
      return 'summary';
    }

    const plan = state.metadata.plan;

    if (verdict.killSwitch === true) {
      // Emergency stop — rare, irreversible
      if (plan?.model) {
        plan.model.setStatus('abandoned');
        plan.model.save().catch(err => console.error('Kill-switch save failed:', err));
      }
      return 'end';  // true termination
    }

    if (verdict.status === 'approve' && (verdict.confidence ?? 0) >= 90) {
      // Goal achieved — mark complete, clean up, go to summary
      if (plan?.model) {
        plan.model.setStatus('completed');
        plan.model.save().catch(err => console.error('Approve save failed:', err));

        // Clean up milestones & plan
        console.log('[Graph] StrategicCritic approved — deleting milestones & plan');
        for (const m of plan.milestones || []) {
          m.model?.delete().catch(err => console.error('Milestone delete failed:', err));
        }
        plan.model.delete().catch(err => console.error('Plan delete failed:', err));
      }

      // Reset plan state for next cycle
      state.metadata.plan = {
        model: undefined,
        milestones: [],
        activeMilestoneIndex: 0,
        allMilestonesComplete: false
      };
      state.metadata.currentSteps = [];
      state.metadata.activeStepIndex = 0;
      state.metadata.strategicCriticVerdict = undefined;
      state.metadata.tacticalCriticVerdict = undefined;

      // Optional: trigger KB async if requested
      if (verdict.triggerKnowledgeBase === true) {
        state.metadata.subGraph = {
          state: 'trigger_subgraph',
          name: 'knowledge',
          prompt: `Document successful plan execution for goal: ${plan?.model?.attributes?.goal || 'unknown'}`,
          response: ''
        };
      }

      return 'summary';
    }

    // Revise — back to planner
    if (verdict.status === 'revise') {
      return 'strategic_planner';
    }

    // Fallback (low confidence, missing verdict, etc.)
    console.warn('[Graph] StrategicCritic unclear verdict — fallback to summary');
    return 'summary';
  });

  // allow looping over again
  graph.addEdge('summary', 'context_trimmer');

  // Set entry and end points
  graph.setEntryPoint('context_trimmer');
  graph.setEndPoints('summary');

  return graph;
}

/**
 * Create a specialized graph for heartbeat-triggered OverLord planning
 * This graph handles autonomous strategic oversight during idle periods
 */
export function createOverlordGraph(): Graph<OverlordThreadState> {

  // Create lightweight heartbeat graph with only core nodes
  const graph = new Graph<OverlordThreadState>();

  graph.addNode(new ContextTrimmerNode<OverlordThreadState>());
  graph.addNode(new OverLordPlannerNode());  // id: 'overlord_planner'
  graph.addNode(new SubgraphTriggerNode());

  // Entry point
  graph.addEdge('context_trimmer', 'overlord_planner');

  // OverLord core loop: think → trigger subgraph → loop or end
  graph.addConditionalEdge('overlord_planner', state => {
    const v = state.metadata;

    // End if you want
    if (v?.projectState === 'end') return 'end';

    // Trigger sub-graph
    if (v?.subGraph.state === 'trigger_subgraph') return 'subgraph_trigger';

    // Defer back to itself
    return 'overlord_planner';
  });

  // Final edge: hierarchical returns here automatically via returnTo flag
  // No need to add hierarchical nodes or edges — handled by sub-graph
  // When hierarchical finishes, it routes back to 'overlord_planner'

  graph.setEntryPoint('context_trimmer');
  graph.setEndPoints('overlord_planner');

  return graph;
}



/**
 * Create a specialized graph for heartbeat-triggered OverLord planning
 * This graph handles autonomous strategic oversight during idle periods
 */
export function createSimpleGraph(): Graph<BaseThreadState> {

  // Create lightweight heartbeat graph with only core nodes
  const graph = new Graph<BaseThreadState>();

  graph.addNode(new MemoryNode());           // id: 'memory_recall'
  graph.addNode(new SimpleNode());  // id: 'simple'

  // Entry point
  graph.addEdge('memory_recall', 'simple');

  graph.setEntryPoint('memory_recall');
  graph.setEndPoints('simple');

  return graph;
}

/**
 * Create a skill-aware ReAct graph for intelligent planning and execution.
 * 
 * This graph combines planning with a reasoning-action loop that can:
 * - Load and follow skill templates (SOPs)
 * - Track progress with evidence-based verification
 * - Execute actions with full tool access via BaseNode
 * - Maintain skill compliance and step verification
 * 
 * Flow: Input → PlanRetrieval → Planner → Reasoning ↔ Action (loop until complete)
 * 
 * Features:
 * - Skill template integration for guided execution
 * - Evidence-based task verification
 * - Progress tracking with completed/pending step separation
 * - ActivePlanManager integration for heartbeats
 * - Quality inspection before marking tasks complete
 * 
 * @returns {Graph} Fully configured skill-aware ReAct graph
 */
export function createSkillGraph(): Graph<SkillGraphState> {
  const graph = new Graph<SkillGraphState>();

  // Add all required nodes
  graph.addNode(new InputHandlerNode());     // id: 'input_handler'
  graph.addNode(new PlanRetrievalNode());    // id: 'plan_retrieval' 
  graph.addNode(new PlannerNode());          // id: 'planner' (skill-aware planning)
  graph.addNode(new ReasoningNode());        // id: 'reasoning'
  graph.addNode(new ActionNode());          // id: 'action'
  graph.addNode(new SkillCriticNode());         // id: 'skill_critic'
  graph.addNode(new OutputNode());              // id: 'output' (skill-aware completion)

  // Sequential flow: Input → PlanRetrieval → Planner
  graph.addEdge('input_handler', 'plan_retrieval');
  graph.addEdge('plan_retrieval', 'planner');

  // Planner → Reasoning (start ReAct loop) - with proper response_immediate handling
  graph.addConditionalEdge('planner', state => {
    const plannerData = (state.metadata as any).planner;
    const planRetrievalData = (state.metadata as any).planRetrieval;
    const responseImmediate = planRetrievalData?.response_immediate;
    const hasPlan = plannerData?.plan_steps?.length > 0;
    
    // Check response_immediate first - this determines the intended flow
    if (responseImmediate === true) {
      console.log('[SkillGraph] Simple response requested - proceeding directly to output');
      return 'output';
    }
    
    // For complex tasks (response_immediate: false), we expect a plan
    if (!hasPlan) {
      // Check retry counter for planner failures
      const plannerRetries = (state.metadata as any).plannerRetries || 0;
      
      if (plannerRetries < MAX_PLANNER_RETRIES) {
        (state.metadata as any).plannerRetries = plannerRetries + 1;
        console.log(`[SkillGraph] Planner failed (attempt ${plannerRetries + 1}/${MAX_PLANNER_RETRIES + 1}) - retrying planner`);
        return 'planner';
      } else {
        console.log(`[SkillGraph] Planner failed after ${MAX_PLANNER_RETRIES + 1} attempts - complex task cannot be completed, proceeding to output with failure`);
        return 'output';
      }
    }
    
    console.log('[SkillGraph] Complex plan ready - starting ReAct loop');
    return 'reasoning';
  });

  // ReAct Loop: Reasoning ↔ Action with loop counter and critic intervention
  graph.addConditionalEdge('reasoning', state => {
    const reasoningData = (state.metadata as any).reasoning?.currentDecision;
    
    if (!reasoningData) {
      // Check retry counter for reasoning failures
      const reasoningRetries = (state.metadata as any).reasoningRetries || 0;
      
      if (reasoningRetries < MAX_REASONING_RETRIES) {
        (state.metadata as any).reasoningRetries = reasoningRetries + 1;
        console.log(`[SkillGraph] Reasoning failed (attempt ${reasoningRetries + 1}/${MAX_REASONING_RETRIES + 1}) - retrying reasoning`);
        return 'reasoning';
      } else {
        console.log(`[SkillGraph] Reasoning failed after ${MAX_REASONING_RETRIES + 1} attempts - proceeding to output with failure`);
        return 'output';
      }
    }
    
    // Reset reasoning retries on successful reasoning
    (state.metadata as any).reasoningRetries = 0;
    
    if (reasoningData.stop_condition_met || reasoningData.action_type === 'complete') {
      console.log('[SkillGraph] Task completed by reasoning - proceeding to output');
      return 'output';
    }
    
    console.log('[SkillGraph] Proceeding to action execution');
    return 'action';
  });
  
  // Action completes → always route through critic for verification (no bypasses)
  graph.addConditionalEdge('action', state => {
    const actionData = (state.metadata as any).actions || [];
    const reasoningData = (state.metadata as any).reasoning?.currentDecision;
    
    // Initialize or increment loop counter
    const currentLoopCount = (state.metadata as any).reactLoopCount || 0;
    const newLoopCount = currentLoopCount + 1;
    (state.metadata as any).reactLoopCount = newLoopCount;
    
    // Always send to critic after action completion for verification
    // The critic will decide if task is truly complete or needs more work
    if (reasoningData?.stop_condition_met || reasoningData?.action_type === 'complete') {
      console.log('[SkillGraph] Task marked complete by reasoning - sending to critic for verification');
      return 'skill_critic';
    }
    
    // After 3 ReAct cycles, send to critic for evaluation
    if (newLoopCount >= 3) {
      console.log(`[SkillGraph] ${newLoopCount} ReAct cycles completed - sending to critic for evaluation`);
      return 'skill_critic';
    }
    
    console.log(`[SkillGraph] Action completed (cycle ${newLoopCount}) - returning to reasoning`);
    return 'reasoning';
  });
  
  // Critic evaluation → routing based on decision
  graph.addConditionalEdge('skill_critic', state => {
    const criticData = (state.metadata as any).skillCritic;
    
    if (!criticData) {
      console.log('[SkillGraph] No critic decision - defaulting to output');
      return 'output';
    }
    
    switch (criticData.decision) {
      case 'continue':
        console.log('[SkillGraph] Critic: Continue ReAct loop');
        // Reset loop counter for next batch of cycles
        (state.metadata as any).reactLoopCount = 0;
        return 'reasoning';
        
      case 'revise':
        console.log('[SkillGraph] Critic: Revise approach - back to planner');
        (state.metadata as any).reactLoopCount = 0;
        return 'planner';
        
      case 'complete':
      default:
        console.log('[SkillGraph] Critic: Task complete - proceeding to output');
        return 'output';
    }
  });

  // Output can loop back to input for continued work
  graph.addConditionalEdge('output', state => {
    const shouldContinue = (state.metadata as any).cycleComplete === false;
    return shouldContinue ? 'input_handler' : 'end';
  });

  // Set entry and end points
  graph.setEntryPoint('input_handler');
  graph.setEndPoints('output');

  return graph;
}
