import { BaseNode, NodeRunPolicy } from './BaseNode';
import type { BaseThreadState, NodeResult } from './Graph';
import { ActivePlanManager } from './ActivePlanManager';
import type { ChatMessage } from '../languagemodels/BaseLanguageModel';

// Types for evidence collection
interface ActionEvidence {
  evidence_type: 'file_created' | 'file_modified' | 'api_response_data' | 'data_generated' | 'tool_output' | 'installation_confirmed';
  description: string;
  evidence_pointer: string;
  evidence_content: any;
  verification_method: string;
  timestamp: number;
}

// Types for action results
interface ActionResult {
  action_type: string;
  tool_name?: string;
  parameters_used: Record<string, any>;
  result: any;
  success: boolean;
  error_message?: string;
  execution_time_ms: number;
  evidence_collected: ActionEvidence[];
  completion_justification: string;
  timestamp: number;
}

// ============================================================================
// ACTION PROMPT SUFFIX
//
// The PRD is the system prompt. This suffix adds the execution directive.
// The technical_instructions tell the action agent exactly what to do this cycle.
// ============================================================================

const ACTION_PROMPT_SUFFIX = `You are the Action Executor Agent in a ReAct graph loop.
You get right to work on the primary focus;
You take massive action and you don't let things stand in your way;
You're incredible about finding ways of getting things accomplished;
You're incredibly resourceful;
You're constantly thinking outside the box when tasks don't easily come together;

**PRIMARY DIRECTIVE (highest priority — never violate):**
Accomplish the goal defined in the Technical Execution Brief (TEB) provided in the latest user message.
The TEB is your source of truth for objective, constraints, and known context.

**ABSOLUTE EXECUTION RULES:**
- You MUST do whatever is necessary to accomplish the TEB goal while respecting its constraints and stated facts.
- Treat Execution Plan and Immediate Action as guidance for the target outcome, not a verbatim script.
- Trust every statement in the "Discovery already completed", "Credentials/integrations status", and "Re-check policy" sections as final facts.
- Begin execution immediately. Do not plan a separate project or gather unnecessary new information.

## Progress Communication Rules (strict)

- While working, you MUST communicate your progress in clear, deterministic language.
- After every major step you MUST explicitly state:
  • What you have just done
  • What you plan to do next
  • Any blockers or decisions
- Use short, direct sentences.
- Your final KEY_RESULT must be a factual evidence snapshot string that points to concrete proof (tool names, returned ids/paths/statuses, and failures if any).
- If the TEB goal is fully accomplished, you MUST stop all explanation and output ONLY the DONE wrapper block with nothing after it.
- If execution is blocked and the TEB goal cannot be completed in this cycle, you MUST stop all explanation and output ONLY the BLOCKED wrapper block with nothing after it.

DONE wrapper (use when goal completed):

<EXECUTOR_DONE>
<KEY_RESULT>[one-line summary of accomplishment]</KEY_RESULT>
</EXECUTOR_DONE>

BLOCKED wrapper (use when goal cannot be completed this cycle):
<EXECUTOR_BLOCKED>
<BLOCKER_REASON>[one-line concrete blocker]</BLOCKER_REASON>
<UNBLOCK_REQUIREMENTS>[exact dependency/credential/input needed to proceed]</UNBLOCK_REQUIREMENTS>
</EXECUTOR_BLOCKED>
`;

const EXECUTOR_DONE_XML_REGEX = /<EXECUTOR_DONE>([\s\S]*?)<\/EXECUTOR_DONE>/i;
const KEY_RESULT_XML_REGEX = /<KEY_RESULT>([\s\S]*?)<\/KEY_RESULT>/i;
const EXECUTOR_BLOCKED_XML_REGEX = /<EXECUTOR_BLOCKED>([\s\S]*?)<\/EXECUTOR_BLOCKED>/i;
const BLOCKER_REASON_XML_REGEX = /<BLOCKER_REASON>([\s\S]*?)<\/BLOCKER_REASON>/i;
const UNBLOCK_REQUIREMENTS_XML_REGEX = /<UNBLOCK_REQUIREMENTS>([\s\S]*?)<\/UNBLOCK_REQUIREMENTS>/i;

// ============================================================================
// ACTION NODE
// ============================================================================

/**
 * Action Node - ReAct Loop Component
 *
 * Purpose:
 *   - Executes actions based on the PRD and technical_instructions from ReasoningNode
 *   - Uses the PRD as its system prompt (complete operating context)
 *   - The technical_instructions tell it exactly what to do this cycle
 *   - Records results for the next reasoning cycle
 *
 * Design:
 *   - System prompt = PRD (planning_instructions) + ACTION_PROMPT_SUFFIX with technical_instructions
 *   - Tools enabled — action agent executes with full tool access
 *   - Results stored in state.metadata.actions for ReasoningNode to review
 */
export class ActionNode extends BaseNode {
  constructor() {
    super('action', 'Action');
  }

  async execute(state: BaseThreadState): Promise<NodeResult<BaseThreadState>> {
    const startTime = Date.now();

    // ----------------------------------------------------------------
    // 1. READ TECHNICAL INSTRUCTIONS
    // ----------------------------------------------------------------
    const technicalInstructions = (state.metadata as any).technical_instructions;

    if (!technicalInstructions) {
      console.warn('[ActionNode] No technical_instructions found — cannot execute without direction');
      return { state, decision: { type: 'next' } };
    }

    // ----------------------------------------------------------------
    // 2. BUILD SYSTEM PROMPT = ACTION DIRECTIVE
    // ----------------------------------------------------------------
    const systemPrompt = ACTION_PROMPT_SUFFIX;

    const enrichedPrompt = await this.enrichPrompt(systemPrompt, state, {
      includeSoul: true,
      includeAwareness: false,
      includeEnvironment: false,
      includeMemory: false,
    });

    console.log(`[ActionNode] Executing with technical_instructions: ${technicalInstructions.substring(0, 100)}...`);

    // ----------------------------------------------------------------
    // 3. EXECUTE — LLM interprets PRD + focus, calls tools
    // ----------------------------------------------------------------
    const actionResult = await this.executeAction(enrichedPrompt, state, startTime);

    const actionResultText = typeof actionResult.result === 'string' ? actionResult.result : '';
    const actionOutcome = this.extractActionOutcome(actionResultText);
    const actionResponse = actionOutcome.summary;
    const nonTechnicalExecutionBriefContent = this.extractNonTechnicalExecutionBriefContent(actionResultText);

    (state.metadata as any).action = {
      ...((state.metadata as any).action || {}),
      status: actionOutcome.status,
      response: actionResponse,
      blocker_reason: actionOutcome.blockerReason,
      unblock_requirements: actionOutcome.unblockRequirements,
      updatedAt: Date.now(),
    };

    this.persistActionEvidenceSnapshotToGraphState(state, actionResponse);

    if (nonTechnicalExecutionBriefContent) {
      await this.wsChatMessage(state, nonTechnicalExecutionBriefContent, 'assistant');
    }

    // ----------------------------------------------------------------
    // 4. STORE ACTION RESULT
    // ----------------------------------------------------------------
    this.storeActionResult(state, actionResult);

    // ----------------------------------------------------------------
    // 5. UPDATE PLAN HEARTBEAT
    // ----------------------------------------------------------------
    await this.updatePlanProgress(state, actionResult);

    // ----------------------------------------------------------------
    // 6. LOG
    // ----------------------------------------------------------------
    const executionTimeMs = Date.now() - startTime;
    const toolCalled = state.metadata.hadToolCalls || false;
    console.log(`[ActionNode] Complete — ${actionResult.success ? 'SUCCESS' : 'FAILED'} in ${executionTimeMs}ms, tools: ${toolCalled}, response: ${actionResponse ? 'present' : 'none'}`);

    return { state, decision: { type: 'next' } };
  }

  // ======================================================================
  // ACTION EXECUTION
  // ======================================================================

  private async executeAction(
    systemPrompt: string,
    state: BaseThreadState,
    startTime: number
  ): Promise<ActionResult> {
    try {
      const policy: Required<NodeRunPolicy> = {
        messageSource: 'custom',
        persistAssistantToGraph: false,
        persistToolResultsToGraph: false,
        persistAssistantToNodeState: false,
        persistToolResultsToNodeState: false,
        nodeStateNamespace: '',
        includeGraphAssistantMessages: true,
        includeGraphUserMessages: true,
      };

      const nodeMessages = this.buildActionNodeMessages(state, policy);

      const chatResult = await this.chat(state, systemPrompt, {
        temperature: 0.2,
        // Tools enabled — action agent has full tool access
        nodeRunPolicy: policy,
        nodeRunMessages: nodeMessages,
      });

      const resultContent = chatResult || 'Action completed';

      return {
        action_type: 'execute',
        parameters_used: { prd_chars: 'see planning_instructions', technical_chars: 'see technical_instructions' },
        result: resultContent,
        success: true,
        execution_time_ms: Date.now() - startTime,
        evidence_collected: [],
        completion_justification: 'Action completed',
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[ActionNode] Action execution failed:', error);

      return {
        action_type: 'execute',
        parameters_used: {},
        result: null,
        success: false,
        error_message: error instanceof Error ? error.message : String(error),
        execution_time_ms: Date.now() - startTime,
        evidence_collected: [],
        completion_justification: `Action failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
      };
    }
  }

  private buildActionNodeMessages(state: BaseThreadState, policy: Required<NodeRunPolicy>): {
    assistantMessages: ChatMessage[];
    userMessages: ChatMessage[];
  } {
    const actionScopedHistory = (((state.metadata as any).__messages_action?.messages || []) as ChatMessage[])
      .filter((message) => {
        if (message.role !== 'assistant') {
          return false;
        }

        const kind = String((message as any)?.metadata?.kind || '').trim();
        if (kind.startsWith('shared_context_')) {
          return false;
        }

        const content = String(message.content || '').trim();
        if (!content.length) {
          return false;
        }

        const normalized = content.toLowerCase();
        const isSharedContextReplay = normalized.startsWith('environment systems and tools context:')
          || normalized.startsWith('observational memory snapshot:')
          || normalized.startsWith('# environment');

        return !isSharedContextReplay;
      })
      .slice(-20)
      .map((message) => ({ ...message }));

    const technicalInstructions = String((state.metadata as any).technical_instructions || '').trim();
    const userDirective: ChatMessage = {
      role: 'user',
      content: technicalInstructions
        ? `Execute this cycle exactly as specified in this Technical Execution Brief:\n${technicalInstructions}`
        : 'Execute the current technical brief for this cycle without expanding scope.',
    };

    const assistantMessages = actionScopedHistory;
    const userMessages = [userDirective];

    return {
      assistantMessages,
      userMessages,
    };
  }

  private extractActionOutcome(actionResultText: string): {
    status: 'done' | 'blocked' | 'in_progress';
    summary: string | null;
    blockerReason: string | null;
    unblockRequirements: string | null;
  } {
    const blockedMatch = EXECUTOR_BLOCKED_XML_REGEX.exec(actionResultText);
    if (blockedMatch) {
      const blockedBlock = String(blockedMatch[1] || '').trim();
      const blockerReasonMatch = BLOCKER_REASON_XML_REGEX.exec(blockedBlock);
      const unblockRequirementsMatch = UNBLOCK_REQUIREMENTS_XML_REGEX.exec(blockedBlock);
      const blockerReason = String(blockerReasonMatch?.[1] || '').trim() || null;
      const unblockRequirements = String(unblockRequirementsMatch?.[1] || '').trim() || null;
      const fallbackSummary = blockedBlock
        .split('\n')
        .map(line => line.trim())
        .find(Boolean) || null;

      return {
        status: 'blocked',
        summary: blockerReason || fallbackSummary,
        blockerReason,
        unblockRequirements,
      };
    }

    const doneMatch = EXECUTOR_DONE_XML_REGEX.exec(actionResultText);
    if (!doneMatch) {
      return {
        status: 'in_progress',
        summary: null,
        blockerReason: null,
        unblockRequirements: null,
      };
    }

    const doneBlock = String(doneMatch[1] || '').trim();
    if (!doneBlock) {
      return {
        status: 'done',
        summary: null,
        blockerReason: null,
        unblockRequirements: null,
      };
    }

    const keyResultMatch = KEY_RESULT_XML_REGEX.exec(doneBlock);
    if (keyResultMatch) {
      const keyResult = String(keyResultMatch[1] || '').trim();
      return {
        status: 'done',
        summary: keyResult || null,
        blockerReason: null,
        unblockRequirements: null,
      };
    }

    const firstLine = doneBlock
      .split('\n')
      .map(line => line.trim())
      .find(Boolean);

    return {
      status: 'done',
      summary: firstLine || null,
      blockerReason: null,
      unblockRequirements: null,
    };
  }

  private extractNonTechnicalExecutionBriefContent(actionResultText: string): string {
    let output = String(actionResultText || '').trim();
    if (!output) {
      return '';
    }

    output = output
      .replace(/<TECHNICAL_EXECUTION_BRIEF>[\s\S]*?<\/TECHNICAL_EXECUTION_BRIEF>/gi, '')
      .replace(/###\s+Technical\s+Execution\s+Brief[\s\S]*?(?=<EXECUTOR_DONE>|$)/gi, '')
      .trim();

    return output;
  }

  private persistActionEvidenceSnapshotToGraphState(state: BaseThreadState, actionResponse: string | null): void {
    const snapshot = String(actionResponse || '').trim();
    if (!snapshot) {
      return;
    }

    if (!Array.isArray(state.messages)) {
      state.messages = [];
    }

    state.messages.push({
      role: 'assistant',
      content: snapshot,
      metadata: {
        nodeId: this.id,
        nodeName: this.name,
        kind: 'action_evidence_snapshot',
        timestamp: Date.now(),
      },
    } as ChatMessage);

    this.bumpStateVersion(state);
  }

  // ======================================================================
  // RESULT STORAGE
  // ======================================================================

  private storeActionResult(state: BaseThreadState, result: ActionResult): void {
    if (!(state.metadata as any).actions) {
      (state.metadata as any).actions = [];
    }
    (state.metadata as any).actions.push(result);
    (state.metadata as any).latestAction = result;

    console.log(`[ActionNode] Result stored: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  }

  // ======================================================================
  // ACTIVE PLAN HEARTBEAT
  // ======================================================================

  private async updatePlanProgress(state: BaseThreadState, actionResult: ActionResult): Promise<void> {
    try {
      const activePlanId = (state.metadata as any).reasoning?.activePlanId;

      if (activePlanId) {
        const threadId = state.metadata.threadId;
        const activePlanManager = ActivePlanManager.getInstance();
        const executorPID = process.pid.toString();

        const heartbeatResult = await activePlanManager.sendHeartbeat(threadId, activePlanId, executorPID);

        console.log(`[ActionNode] Heartbeat sent for plan: ${activePlanId}, success: ${actionResult.success}`);

        if (!heartbeatResult.success) {
          console.warn('[ActionNode] Plan heartbeat failed — may have been taken over');
        }
      } else {
        console.log('[ActionNode] No active plan ID — skipping heartbeat');
      }
    } catch (error) {
      console.warn('[ActionNode] Error updating plan progress:', error);
    }
  }
}
