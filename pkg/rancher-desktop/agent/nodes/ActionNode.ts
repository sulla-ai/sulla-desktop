import { BaseNode, NodeRunPolicy } from './BaseNode';
import type { BaseThreadState, NodeResult } from './Graph';
import { ActivePlanManager } from './ActivePlanManager';
import type { ChatMessage } from '../languagemodels/BaseLanguageModel';
import { getN8nBridgeService, type N8nBridgeEventMap } from '../services/N8nBridgeService';
import type { WebSocketMessage } from '../services/WebSocketClientService';

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

type N8nLiveEvent = {
  timestamp: string;
  type: 'websocket' | 'execution' | 'error';
  action?: string;
  workflowId?: string;
  executionId?: string;
  nodeName?: string;
  message?: string;
  data?: unknown;
};

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
    const disposeLiveDomStream = await this.startLiveDomStream(state);
    const disposeLiveN8nStream = await this.startLiveN8nActionStream(state);
    const actionResult = await this.executeAction(enrichedPrompt, state, startTime)
      .finally(() => {
        disposeLiveDomStream();
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
        includeGraphAssistantMessages: false,
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

  // ======================================================================
  // GENERIC LIVE DOM STREAM (all website assets)
  // ======================================================================

  private async startLiveDomStream(state: BaseThreadState): Promise<() => void> {
    try {
      const { hostBridgeRegistry } = await import('../scripts/injected/HostBridgeRegistry');

      if (hostBridgeRegistry.size() === 0) {
        return () => {};
      }

      const unsub = hostBridgeRegistry.onDomEvent((event) => {
        const content = event.message;
        if (!content) return;

        if (this.shouldAppendLiveDomEvent(state, content)) {
          this.appendLiveDomMessage(state, content, event);
        }

        console.log('[ActionNode] DOM event received:', {
          assetId: event.assetId,
          type: event.type,
          message: content.slice(0, 120),
        });
      });

      console.log('[ActionNode] Live DOM stream started for all assets');
      return unsub;
    } catch (error) {
      console.warn('[ActionNode] Unable to start live DOM stream:', error);
      return () => {};
    }
  }

  private shouldAppendLiveDomEvent(state: BaseThreadState, content: string): boolean {
    const metadataAny = state.metadata as any;
    const liveMeta = metadataAny.__domLiveEvent || {};
    const now = Date.now();

    // Dedup: same content within 500ms
    if (liveMeta.lastContent === content && now - Number(liveMeta.lastAt || 0) < 500) {
      return false;
    }

    metadataAny.__domLiveEvent = {
      lastContent: content,
      lastAt: now,
    };

    return true;
  }

  private appendLiveDomMessage(
    state: BaseThreadState,
    content: string,
    event: { assetId: string; type: string; timestamp: number },
  ): void {
    const message: ChatMessage = {
      role: 'assistant',
      content,
      metadata: {
        nodeId: this.id,
        nodeName: this.name,
        kind: 'action_live_dom_event',
        source: 'dom_event_stream',
        transport: 'ipc',
        eventType: event.type,
        assetId: event.assetId,
        timestamp: event.timestamp,
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
  }

  // ======================================================================
  // LIVE N8N ACTION STREAM (n8n-specific — to be deprecated)
  // ======================================================================

  private async startLiveN8nActionStream(state: BaseThreadState): Promise<() => void> {
    // leave this in place, I've commented it out only for testing atm
    //if ((state.metadata as any).n8nLiveEventsEnabled !== true) { return () => {}; }

    try {
      const bridge = getN8nBridgeService();
      if (!ActionNode.n8nBridgeStartPromise) {
        ActionNode.n8nBridgeStartPromise = bridge.start().catch((error) => {
          ActionNode.n8nBridgeStartPromise = null;
          throw error;
        });
      }

      await ActionNode.n8nBridgeStartPromise;

      const wsChannel = String((state.metadata as any).wsChannel || 'chat-controller');
      const selectedSkillSlug = String((state.metadata as any).planRetrieval?.selected_skill_slug || '');
      const n8nRootUrl = String(bridge.getAppRootUrl() || 'http://127.0.0.1:30119/').trim();
      const bridgeSocketUnsubs = this.subscribeToBridgeSocketEvents(state);

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

      return () => {
        for (const unsub of bridgeSocketUnsubs) {
          try {
            unsub();
          } catch {
            // no-op
          }
        }
      };
    } catch (error) {
      console.warn('[ActionNode] Unable to start live n8n event stream:', error);
      return () => {};
    }
  }

  private subscribeToBridgeSocketEvents(state: BaseThreadState): Array<() => void> {
    const bridge = getN8nBridgeService();
    const unsubs: Array<() => void> = [];
    const n8nInterfaceChannel = 'n8n_interface';

    const onSocketEvent = <K extends keyof N8nBridgeEventMap>(
      event: K,
      toEventEntry: (payload: N8nBridgeEventMap[K]) => Omit<N8nLiveEvent, 'timestamp'>,
    ) => {
      unsubs.push(bridge.on(event, (payload: N8nBridgeEventMap[K]) => {
        const entry: N8nLiveEvent = {
          ...toEventEntry(payload),
          timestamp: new Date().toISOString(),
        };
        const formatted = this.formatLiveN8nEvent(entry);

        if (formatted && this.shouldAppendLiveN8nEvent(state, formatted)) {
          this.appendActionLiveAssistantMessage(state, formatted, entry);
        }

        console.log('[ActionNode] bridge socket event received:', {
          event,
          formatted,
          entry,
        });
      }));
    };

    onSocketEvent('workflowUpdated', payload => ({
      type: 'websocket',
      action: 'workflowUpdated',
      workflowId: payload.workflowId,
      data: payload.raw,
    }));

    onSocketEvent('executionStarted', payload => ({
      type: 'execution',
      action: 'started',
      executionId: payload.executionId,
      workflowId: payload.workflowId,
      data: payload.raw,
    }));

    onSocketEvent('nodeExecuted', payload => ({
      type: 'execution',
      action: 'nodeExecuted',
      executionId: payload.executionId,
      workflowId: payload.workflowId,
      nodeName: payload.nodeName,
      data: payload.raw,
    }));

    onSocketEvent('errorOccurred', payload => ({
      type: 'error',
      action: 'bridgeError',
      message: payload.message,
      data: payload.raw,
    }));

    onSocketEvent('rawMessage', payload => ({
      type: 'websocket',
      action: 'rawMessage',
      data: payload,
    }));

    this.connectWebSocket(n8nInterfaceChannel);
    const n8nInterfaceUnsub = this.listenToWebSocket(n8nInterfaceChannel, (msg: WebSocketMessage) => {
      if (msg.type !== 'n8n_vue_bridge_event') {
        return;
      }

      const data = (msg.data && typeof msg.data === 'object') ? (msg.data as any) : null;
      const payloadThreadId = String(data?.threadId || '').trim();
      const stateThreadId = String((state.metadata as any).threadId || '').trim();
      if (payloadThreadId && stateThreadId && payloadThreadId !== stateThreadId) {
        return;
      }

      const content = String(data?.content || '').trim();
      if (!content) {
        return;
      }

      const entry: N8nLiveEvent = {
        timestamp: new Date().toISOString(),
        type: 'websocket',
        action: `ui:${String(data?.eventType || 'event').trim() || 'event'}`,
        data: data?.payload,
      };

      if (this.shouldAppendLiveN8nEvent(state, content)) {
        this.appendActionLiveAssistantMessage(state, content, entry);
      }

      console.log('[ActionNode] n8n_interface event received:', {
        eventType: data?.eventType,
        content,
        payload: data?.payload,
      });
    });

    if (n8nInterfaceUnsub) {
      unsubs.push(n8nInterfaceUnsub);
    }

    return unsubs;
  }

  private formatLiveN8nEvent(entry: N8nLiveEvent): string {
    if (!entry) {
      return '';
    }

    if (entry.action === 'rawMessage') {
      return '';
    }

    const head = entry.type === 'websocket' ? '[n8n wss]' : `[n8n ${entry.type}]`;
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

  private appendActionLiveAssistantMessage(state: BaseThreadState, content: string, entry: N8nLiveEvent): void {
    const normalizedContent = entry.type === 'websocket' && !String(content).startsWith('[WSS]')
      ? `[WSS] ${content}`
      : content;

    const message: ChatMessage = {
      role: 'assistant',
      content: normalizedContent,
      metadata: {
        nodeId: this.id,
        nodeName: this.name,
        kind: 'action_live_n8n_event',
        source: 'n8n_event_stream',
        transport: entry.type === 'websocket' ? 'wss' : 'internal',
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
    if (entry.type !== 'websocket') {
      void this.wsChatMessage(state, normalizedContent, 'assistant', 'progress');
    }
  }

  private buildActionNodeMessages(state: BaseThreadState, policy: Required<NodeRunPolicy>): {
    assistantMessages: ChatMessage[];
    userMessages: ChatMessage[];
  } {
    const metadataAny = state.metadata as any;
    const namespace = '__messages_action';
    if (!metadataAny[namespace] || !Array.isArray(metadataAny[namespace].messages)) {
      metadataAny[namespace] = { messages: [], graphSeedInitialized: true };
    }

    const laneMessages = (metadataAny[namespace].messages || []) as ChatMessage[];
    const technicalInstructions = String(metadataAny.technical_instructions || '').trim();

    if (technicalInstructions) {
      const hasSeededTechnicalInstructions = laneMessages.some((message) => {
        if (message.role !== 'user') {
          return false;
        }

        const kind = String((message as any)?.metadata?.kind || '').trim();
        if (kind === 'action_seed_user_instructions') {
          return true;
        }

        return String(message.content || '').trim() === technicalInstructions;
      });

      if (!hasSeededTechnicalInstructions) {
        laneMessages.push({
          role: 'user',
          content: technicalInstructions,
          metadata: {
            nodeId: this.id,
            nodeName: this.name,
            kind: 'action_seed_user_instructions',
            timestamp: Date.now(),
          },
        } as ChatMessage);
        this.bumpStateVersion(state);
      }
    }

    const actionScopedHistory = laneMessages
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

    const assistantMessages = actionScopedHistory;
    const userMessages: ChatMessage[] = laneMessages
      .filter((message) => message.role === 'user')
      .map((message) => ({ ...message }));

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
