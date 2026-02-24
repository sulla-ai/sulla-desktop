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

const ACTION_PROMPT_SUFFIX = `You are the Execution Agent.

**Inputs every cycle:**
- Current Technical Execution Brief (your technical instructions for this cycle)
- Previous action results / message history

**Rules:**
- Execute the steps outlined in the Technical Execution Brief.
- Use tools aggressively and correctly to complete the work.
- You may freely output text, observations, tool calls, results, and thinking as you progress.
- Do NOT use the old rigid # Execution Report format.
- When you believe the current cycle is fully complete, end your entire response with exactly this marker and nothing after:

===EXECUTOR DONE===
Key result: [one-line summary of accomplishment]

---
{{technical_instructions}}

`;

const EXECUTOR_DONE_MARKER_REGEX = /^\s*===EXECUTOR DONE===\s*$/m;

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
    // 2. BUILD SYSTEM PROMPT = PRD + ACTION DIRECTIVE WITH TECHNICAL INSTRUCTIONS
    // ----------------------------------------------------------------
      const systemPrompt = ACTION_PROMPT_SUFFIX
        .replace('{{technical_instructions}}', technicalInstructions);

    const enrichedPrompt = await this.enrichPrompt(systemPrompt, state, {
      includeSoul: false,
      includeAwareness: true,
      includeMemory: false
    });

    console.log(`[ActionNode] Executing with technical_instructions: ${technicalInstructions.substring(0, 100)}...`);

    // ----------------------------------------------------------------
    // 3. EXECUTE — LLM interprets PRD + focus, calls tools
    // ----------------------------------------------------------------
    const actionResult = await this.executeAction(enrichedPrompt, state, startTime);

    const actionResultText = typeof actionResult.result === 'string' ? actionResult.result : '';
    const actionResponse = this.extractActionResponse(actionResultText);

    (state.metadata as any).action = {
      ...((state.metadata as any).action || {}),
      response: actionResponse,
      updatedAt: Date.now(),
    };

    if (!actionResponse && actionResultText.trim()) {
      await this.wsChatMessage(state, actionResultText.trim(), 'assistant');
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
        includeGraphAssistantMessages: false,
        includeGraphUserMessages: false,
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
    const technicalInstructions = String((state.metadata as any).technical_instructions || '').trim();
    const userDirective: ChatMessage = {
      role: 'user',
      content: technicalInstructions
        ? `Execute this cycle only based on the technical brief:\n${technicalInstructions}`
        : 'Execute the current technical brief for this cycle.',
    };

    const assistantMessages = this.buildAssistantMessagesForNode(state, policy, []);
    const userMessages = this.buildUserMessagesForNode(state, policy, [userDirective]);

    return {
      assistantMessages,
      userMessages,
    };
  }

  private extractActionResponse(actionResultText: string): string | null {
    const markerMatch = EXECUTOR_DONE_MARKER_REGEX.exec(actionResultText);

    if (!markerMatch) {
      return null;
    }

    const afterMarker = actionResultText.slice(markerMatch.index + markerMatch[0].length).trim();

    if (!afterMarker) {
      return null;
    }

    const firstLine = afterMarker
      .split('\n')
      .map(line => line.trim())
      .find(Boolean);

    return firstLine || null;
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
