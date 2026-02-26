import { BaseNode, NodeRunPolicy } from './BaseNode';
import type { BaseThreadState, NodeResult } from './Graph';
import { ActivePlanManager } from './ActivePlanManager';
import type { ChatMessage } from '../languagemodels/BaseLanguageModel';
import { getN8nBridgeService } from '../services/N8nBridgeService';
import { getN8nEventLog, type N8nLogEntry } from '../services/N8nEventLog';
import { getN8nStateStore } from '../services/N8nStateStore';

// ============================================================================
// ACTION PROMPT SUFFIX
//
// The PRD is the system prompt. This suffix adds the execution directive.
// The technical_instructions tell the action agent exactly what to do this cycle.
// ============================================================================

const ACTION_PROMPT_BASE = `You are the Action Executor Agent in a ReAct graph loop.
You get right to work on the primary focus;
You take massive action and you don't let things stand in your way;
You're incredible about finding ways of getting things accomplished;
You're incredibly resourceful;
You're constantly thinking outside the box when tasks don't easily come together;`;

const ACTION_PROMPT_TEB_ONLY = `**PRIMARY DIRECTIVE (highest priority — never violate):**
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
- If execution is blocked and the TEB goal cannot be completed in this cycle, you MUST stop all explanation and output ONLY the BLOCKED wrapper block with nothing after it.`;

const ACTION_PROMPT_COMPLETION_WRAPPERS = `
CRITICAL CONTINUITY RULES:
- This is a persistent conversation. Review the entire message history + the facts above before every action.
- If you see the same user request again, it means previous actions failed or were incomplete — continue from there using the latest state.
- Never restart or repeat steps that are already marked complete in memory.
- Don't use language that would suggest this is a brand new conversation, like :"On it.", "Got it." etc.

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
  private static n8nBridgeStartPromise: Promise<void> | null = null;

  constructor() {
    super('action', 'Action');
  }

  async execute(state: BaseThreadState): Promise<NodeResult<BaseThreadState>> {
    const startTime = Date.now();

    // ----------------------------------------------------------------
    // 1. READ TECHNICAL INSTRUCTIONS
    // ----------------------------------------------------------------
    const technicalInstructions = String((state.metadata as any).technical_instructions || '').trim();
    if (!technicalInstructions) {
      console.log('[ActionNode] No technical_instructions found — executing with fallback directive');
    }

    // ----------------------------------------------------------------
    // 2. BUILD SYSTEM PROMPT = ACTION DIRECTIVE
    // ----------------------------------------------------------------
    const systemPrompt = technicalInstructions
      ? `${ACTION_PROMPT_BASE}\n\n${ACTION_PROMPT_TEB_ONLY}\n\n${ACTION_PROMPT_COMPLETION_WRAPPERS}`
      : `${ACTION_PROMPT_BASE}\n\n${ACTION_PROMPT_COMPLETION_WRAPPERS}`;

    const enrichedPrompt = await this.enrichPrompt(systemPrompt, state, {
      includeSoul: true,
      includeAwareness: true,
      includeEnvironment: true,
      includeMemory: false,
    });

    console.log(
      `[ActionNode] Executing with technical_instructions: ${technicalInstructions ? `${technicalInstructions.substring(0, 100)}...` : '[none]'}`
    );

    // ----------------------------------------------------------------
    // 3. EXECUTE — LLM interprets PRD + focus, calls tools
    // ----------------------------------------------------------------
    const disposeLiveN8nStream = await this.startLiveN8nActionStream(state);
    const actionResult = await this.executeAction(enrichedPrompt, state, startTime)
      .finally(() => {
        disposeLiveN8nStream();
      });

    const actionResultText = typeof actionResult === 'string' ? actionResult : '';
    const actionOutcome = this.extractActionOutcome(actionResultText);

    (state.metadata as any).action = {
      ...((state.metadata as any).action || {}),
      status: actionOutcome.status,
      blocker_reason: actionOutcome.blockerReason,
      unblock_requirements: actionOutcome.unblockRequirements,
      updatedAt: Date.now(),
    };

    if (actionResultText) {
      if (!Array.isArray(state.messages)) {
        state.messages = [];
      }
      state.messages.push({
        role: 'assistant',
        content: actionResultText,
        metadata: {
          nodeId: this.id,
          nodeName: this.name,
          kind: 'action_result',
          timestamp: Date.now(),
        },
      } as ChatMessage);
      this.bumpStateVersion(state);
      await this.wsChatMessage(state, actionResultText, 'assistant');
    }

    // ----------------------------------------------------------------
    // 4. UPDATE PLAN HEARTBEAT
    // ----------------------------------------------------------------
    await this.updatePlanProgress(state, actionOutcome.status === 'done');

    // ----------------------------------------------------------------
    // 5. LOG
    // ----------------------------------------------------------------
    const executionTimeMs = Date.now() - startTime;
    console.log(`[ActionNode] Complete — status: ${actionOutcome.status} in ${executionTimeMs}ms`);

    return { state, decision: { type: 'next' } };
  }

  // ======================================================================
  // ACTION EXECUTION
  // ======================================================================

  private async executeAction(
    systemPrompt: string,
    state: BaseThreadState,
    startTime: number
  ): Promise<string | null> {
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

      return chatResult || null;
    } catch (error) {
      console.error('[ActionNode] Action execution failed:', error);
      return null;
    }
  }

  private async startLiveN8nActionStream(state: BaseThreadState): Promise<() => void> {
    // leave this in place, I've commented it out only for testing atm
    //if ((state.metadata as any).n8nLiveEventsEnabled !== true) { return () => {}; }

    try {
      const wsChannel = String((state.metadata as any).wsChannel || 'chat-controller');
      const selectedSkillSlug = String((state.metadata as any).planRetrieval?.selected_skill_slug || '');
      const n8nRootUrl = String(getN8nBridgeService().getAppRootUrl() || 'http://127.0.0.1:30119/').trim();

      void this.dispatchToWebSocket(wsChannel, {
        type: 'register_or_activate_asset',
        data: {
          asset: {
            type: 'iframe',
            id: 'sulla_n8n',
            title: 'Sulla n8n',
            url: n8nRootUrl,
            active: true,
            collapsed: true,
            skillSlug: selectedSkillSlug,
            refKey: `graph.skill.${selectedSkillSlug || 'workflow'}.website_url`,
          },
        },
        timestamp: Date.now(),
      });

      const eventLog = await this.getN8nEventLogReady();
      const onLogAdded = (entry: N8nLogEntry) => {
        console.log('[ActionNode] live n8n eventLog entry received:', entry);
        const message = this.formatLiveN8nEvent(entry);
        if (!message) {
          return;
        }

        if (!this.shouldAppendLiveN8nEvent(state, message)) {
          return;
        }

        this.appendActionLiveAssistantMessage(state, message, entry);
      };

      eventLog.on('log:added', onLogAdded);

      return () => {
        eventLog.off('log:added', onLogAdded);
      };
    } catch (error) {
      console.warn('[ActionNode] Unable to start live n8n event stream:', error);
      return () => {};
    }
  }

  private async getN8nEventLogReady() {
    const bridge = getN8nBridgeService();
    if (!ActionNode.n8nBridgeStartPromise) {
      ActionNode.n8nBridgeStartPromise = bridge.start().catch((error) => {
        ActionNode.n8nBridgeStartPromise = null;
        throw error;
      });
    }

    await ActionNode.n8nBridgeStartPromise;
    const stateStore = getN8nStateStore(bridge);
    return getN8nEventLog(bridge, stateStore);
  }

  private formatLiveN8nEvent(entry: N8nLogEntry): string {
    if (!entry) {
      return '';
    }

    if (entry.type === 'state' || entry.action === 'rawMessage') {
      return '';
    }

    const head = `[n8n ${entry.type}]`;
    const action = entry.action ? ` ${entry.action}` : '';
    const workflow = entry.workflowId ? ` workflow=${entry.workflowId}` : '';
    const execution = entry.executionId ? ` execution=${entry.executionId}` : '';
    const node = entry.nodeName ? ` node=${entry.nodeName}` : '';
    const message = entry.message ? ` — ${entry.message}` : '';

    return `${head}${action}${workflow}${execution}${node}${message}`.trim();
  }

  private shouldAppendLiveN8nEvent(state: BaseThreadState, content: string): boolean {
    const metadataAny = state.metadata as any;
    const liveMeta = metadataAny.__actionLiveEvent || {};
    const now = Date.now();

    if (liveMeta.lastContent === content && now - Number(liveMeta.lastAt || 0) < 1000) {
      return false;
    }

    metadataAny.__actionLiveEvent = {
      lastContent: content,
      lastAt: now,
    };

    return true;
  }

  private appendActionLiveAssistantMessage(state: BaseThreadState, content: string, entry: N8nLogEntry): void {
    const message: ChatMessage = {
      role: 'assistant',
      content,
      metadata: {
        nodeId: this.id,
        nodeName: this.name,
        kind: 'action_live_n8n_event',
        source: 'n8n_event_stream',
        eventType: entry.type,
        action: entry.action,
        workflowId: entry.workflowId,
        executionId: entry.executionId,
        timestamp: Date.now(),
      },
    };

    state.messages.push(message);

    const metadataAny = state.metadata as any;
    const namespace = '__messages_action';
    if (!metadataAny[namespace] || !Array.isArray(metadataAny[namespace].messages)) {
      metadataAny[namespace] = { messages: [], graphSeedInitialized: true };
    }
    metadataAny[namespace].messages.push({ ...message });

    this.bumpStateVersion(state);
    void this.wsChatMessage(state, content, 'assistant', 'progress');
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

    const assistantMessages = actionScopedHistory;
    const userMessages: ChatMessage[] = [];

    if (technicalInstructions) {
      userMessages.push({
        role: 'user',
        content: `${technicalInstructions}`,
      });
    }

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

  // ======================================================================
  // ACTIVE PLAN HEARTBEAT
  // ======================================================================

  private async updatePlanProgress(state: BaseThreadState, success: boolean): Promise<void> {
    try {
      const activePlanId = (state.metadata as any).reasoning?.activePlanId;

      if (activePlanId) {
        const threadId = state.metadata.threadId;
        const activePlanManager = ActivePlanManager.getInstance();
        const executorPID = process.pid.toString();

        const heartbeatResult = await activePlanManager.sendHeartbeat(threadId, activePlanId, executorPID);

        console.log(`[ActionNode] Heartbeat sent for plan: ${activePlanId}, success: ${success}`);

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
