// StrategicPlannerNode.ts
// High-level goal decomposition into milestones
// Persists to AgentPlan / AgentPlanTodo models
// Returns neutral decision — graph edges route next

import type { HierarchicalThreadState, NodeResult } from './Graph';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS, TOOLS_RESPONSE_JSON } from './BaseNode';
import { AgentPlan, AgentPlanInterface, PlanStatus } from '../database/models/AgentPlan';
import { AgentPlanTodo, AgentPlanTodoInterface, TodoStatus } from '../database/models/AgentPlanTodo';

const STRATEGIC_PLAN_PROMPT = `
You are a strategic autonomous agent. Your job is to make real progress on the user's request — not just acknowledge it.

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "emit_chat_message": "short message user sees",
  "action": "direct_answer" | "ask_clarification" | "use_tools" | "create_plan" | "run_again" | "direct_answer" | "ask_clarification", // default is "run_again"
  ${TOOLS_RESPONSE_JSON}
  "plan"?: {
    "goal": "short title",
    "goaldescription": "1-2 sentence outcome",
    "milestones": [
      {
        "id": "m1",
        "title": "string",
        "description": "string",
        "successcriteria": "string",
        "dependson": ["m0"]
      }
    ]
  },
}
`;

/**
 * Strategic Planner Node
 *
 * Purpose:
 *   - Decomposes user intent into high-level goal + milestones
 *   - Persists plan to DB (AgentPlan + AgentPlanTodo)
 *   - Activates first milestone if plan created
 *   - Handles simple vs multi-step paths
 *
 * Key Design Decisions (2025 refactor):
 *   - Removed AgentLog / console.log / agentWarn
 *   - Unified BaseNode.chat() + direct parsed .content access
 *   - Enrichment: soul + awareness + memory + tools (names only)
 *   - Persists via AgentPlan / AgentPlanTodo models directly
 *   - Neutral decision only — graph edges decide next
 *   - WS feedback only on plan creation / simple response
 *   - No retry counter bloat — graph-level protection
 *
 * Input expectations:
 *   - Recent user message in state.messages
 *   - HierarchicalThreadState shape
 *
 * Output mutations:
 *   - state.metadata.plan ← { model, milestones[], activeMilestoneIndex, allMilestonesComplete }
 *   - DB: new/existing AgentPlan + AgentPlanTodo records
 *   - state.metadata.activeMilestoneIndex = 0 on new plan
 *
 * @extends BaseNode
 */
export class StrategicPlannerNode extends BaseNode {
  constructor() {
    super('strategic_planner', 'Strategic Planner');
  }

  async execute(state: HierarchicalThreadState): Promise<NodeResult<HierarchicalThreadState>> {

    // Establish WebSocket connection using the dynamic channel from state
    const connectionId = state.metadata.wsChannel as string;
    if (connectionId && !this.isWebSocketConnected(connectionId)) {
      this.connectWebSocket(connectionId);
    }

    const enriched = await this.enrichPrompt(STRATEGIC_PLAN_PROMPT, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: true,
      includeTools: true,
      includeStrategicPlan: false,
      includeTacticalPlan: false,
      includeKnowledgebasePlan: false,
    });

    const llmResponse = await this.chat(
      state,
      enriched,
      { format: 'json' }
    );

    if (!llmResponse) {
      return { state, decision: { type: 'continue' } }; // continue
    }

    const plan = llmResponse as StrategicPlan;

    if (plan.observational_memory) {
      await this.executeSingleTool(state, ["observational_memory", plan.observational_memory]);
    }

    if (plan.action === 'use_tools') {
      const data = llmResponse as { tools: any[]; markDone: boolean };
      const tools = Array.isArray(data.tools) ? data.tools : [];

      // Execute tools if instructed
      if (tools.length > 0) {
        await this.executeToolCalls(state, tools);
      }
    }
    
    if (plan.emit_chat_message?.trim()) {
      await this.executeSingleTool(state, ["emit_chat_message", plan.emit_chat_message]);
    }

    if (plan.action === 'direct_answer' || plan.action === 'ask_clarification') {
      return { state, decision: { type: 'end' } };
    }

    if (plan.create_plan) {
      // Ensure required fields have defaults
      plan.goal = plan.goal?.trim() || "Assist with user request";
      plan.goaldescription = plan.goaldescription?.trim() || "Provide helpful response to user inquiry";
      plan.requirestools = plan.requirestools ?? true;
      plan.responseguidance = plan.responseguidance || { tone: "helpful", format: "concise" };

      await this.updatePlan(state, plan);
    }

    if (plan.action === 'run_again') {
      return { state, decision: { type: 'continue' } };
    }
    return { state, decision: { type: 'next' } };
  }

  /**
   * Update or create a plan in the database and state
   */
  private async updatePlan(state: HierarchicalThreadState, plan: StrategicPlan): Promise<void> {
    console.log('[StrategicPlanner] updatePlan started');
    console.log('[StrategicPlanner] state.metadata:', JSON.stringify(state.metadata, null, 2));
    
    // Defensive check for milestones
    if (!plan.milestones || !Array.isArray(plan.milestones)) {
      console.error('[StrategicPlanner] Invalid milestones:', plan.milestones);
      plan.milestones = [];
    }
    
    // check if the plan is already in the state object
    let planModel = state.metadata.plan?.model;
    console.log('[StrategicPlanner] Existing planModel:', planModel ? 'found' : 'not found');
    
    if (planModel) {
      console.log('[StrategicPlanner] Plan already exists:', planModel.attributes);
      console.log('[StrategicPlanner] Plan exists ID:', planModel.attributes.id);

      planModel.fill({
        thread_id: state.metadata.threadId,
        status: 'active',
        goal: plan.goal,
        goaldescription: plan.goaldescription,
        complexity: plan.estimatedcomplexity,
        requirestools: plan.requirestools,
        wschannel: state.metadata.wsChannel,
      });
      
      planModel.fill({
        thread_id: state.metadata.threadId,
        status: 'active' as PlanStatus,
        goal: plan.goal,
        goaldescription: plan.goaldescription,
        complexity: plan.estimatedcomplexity,
        requirestools: plan.requirestools,
        wschannel: state.metadata.wsChannel,
      });
      
      console.log('[StrategicPlanner] After fill, plan attributes:', planModel.attributes);
      console.log('[StrategicPlanner] Calling incrementRevision...');
      await planModel.incrementRevision();
      console.log('[StrategicPlanner] incrementRevision completed');
      
      console.log('[StrategicPlanner] Calling deleteAllTodos...');
      await planModel.deleteAllTodos();
      console.log('[StrategicPlanner] deleteAllTodos completed');

    // Create a new plan
    } else {
      console.log('[StrategicPlanner] Creating new plan:', plan);
      console.log('[StrategicPlanner] New AgentPlan instance created');
      
      planModel = new AgentPlan();
      console.log('[StrategicPlanner] planModel before fill:', planModel.attributes);
      
      const fillData = {
        thread_id: state.metadata.threadId,
        status: 'active' as PlanStatus,
        goal: plan.goal,
        goaldescription: plan.goaldescription,
        complexity: plan.estimatedcomplexity,
        requirestools: plan.requirestools,
        wschannel: state.metadata.wsChannel,
      };
      
      console.log('[StrategicPlanner] Fill data for new plan:', fillData);
      planModel.fill(fillData);
      console.log('[StrategicPlanner] planModel after fill:', planModel.attributes);
      console.log('[StrategicPlanner] Calling save on new plan...');
      
      await planModel.save();
      console.log('[StrategicPlanner] New plan saved successfully');
      console.log('[StrategicPlanner] New plan ID after save:', planModel.attributes.id);
      
      state.metadata.plan.model = planModel;
      console.log('[StrategicPlanner] Plan model stored in state');

    }

    console.log('[StrategicPlanner] Plan created/updated, processing milestones:', plan.milestones.length);
    console.log('[StrategicPlanner] Plan model ID for todos:', planModel.attributes.id);

    // Create new todos
    const todos: AgentPlanTodo[] = [];
    for (const [idx, m] of plan.milestones.entries()) {
      console.log(`[StrategicPlanner] Processing milestone ${idx}:`, m);
      
      const todo = new AgentPlanTodo();
      console.log(`[StrategicPlanner] Created todo instance for milestone ${idx}`);
      
      const todoData = {
        plan_id: planModel.attributes.id!,
        title: m.title,
        description: `${m.description}\n\nSuccess: ${m.successcriteria}`,
        order_index: idx,
        status: (idx === 0 ? 'in_progress' : 'pending') as TodoStatus,
        wschannel: state.metadata.wsChannel,
      };
      
      console.log(`[StrategicPlanner] Todo data for milestone ${idx}:`, todoData);
      todo.fill(todoData);
      console.log(`[StrategicPlanner] Todo filled for milestone ${idx}:`, todo.attributes);
      
      console.log(`[StrategicPlanner] Saving todo for milestone ${idx}...`);
      await todo.save();
      console.log(`[StrategicPlanner] Todo saved for milestone ${idx}, ID:`, todo.attributes.id);
      
      todos.push(todo);
    }
    
    console.log('[StrategicPlanner] All todos created:', todos.length);

    // Update state shape
    console.log('[StrategicPlanner] Updating state shape...');
    state.metadata.plan = {
      model: planModel,
      milestones: todos.map(todo => ({ model: todo })),
      activeMilestoneIndex: 0,
      allMilestonesComplete: false,
    };
    console.log('[StrategicPlanner] State updated successfully');
    console.log('[StrategicPlanner] updatePlan completed');
  }
}

interface StrategicPlan {
  action: 'direct_answer' | 'ask_clarification' | 'use_tools' | 'create_plan' | 'run_again';
  tools: any[];
  observational_memory: any;
  goal: string;
  goaldescription: string;
  requirestools: boolean;
  estimatedcomplexity: 'simple' | 'moderate' | 'complex';
  create_plan: boolean;
  milestones: Array<{
    id: string;
    title: string;
    description: string;
    successcriteria: string;
    dependson: string[];
  }>;
  responseguidance: {
    tone: string;
    format: string;
  };
  emit_chat_message?: string;
}