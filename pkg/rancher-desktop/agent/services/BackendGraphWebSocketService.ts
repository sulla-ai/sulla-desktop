// BackendGraphWebSocketService.ts
// Main-process graph executor: handles the heartbeat (dreaming-protocol) channel
// and the chat-controller agent channel. Dynamic agent channels are handled
// by FrontendGraphWebSocketService in the renderer.
import { getWebSocketClientService, type WebSocketMessage } from './WebSocketClientService';
import { getSchedulerService } from './SchedulerService';
import type { CalendarEventData } from './CalendarClient';
import { AbortService } from './AbortService';
import { GraphRegistry, nextThreadId, nextMessageId } from './GraphRegistry';
import { SullaSettingsModel } from '../database/models/SullaSettingsModel';
import type { AgentGraphState } from '../nodes/Graph';
import type { HeartbeatThreadState } from '../nodes/HeartbeatNode';

const BACKEND_CHANNEL_ID = 'dreaming-protocol';
const CALENDAR_CHANNEL_ID = 'calendar_event';
const CHAT_CONTROLLER_CHANNEL_ID = 'chat-controller';

/** Per-channel state for agent channels (e.g. chat-controller). */
type AgentChannelState = {
  unsubscribe: () => void;
  activeAbort: AbortService | null;
};

let backendGraphWebSocketServiceInstance: BackendGraphWebSocketService | null = null;

export function getBackendGraphWebSocketService(): BackendGraphWebSocketService {
  if (!backendGraphWebSocketServiceInstance) {
    backendGraphWebSocketServiceInstance = new BackendGraphWebSocketService();
  }
  return backendGraphWebSocketServiceInstance;
}

export class BackendGraphWebSocketService {
  private readonly wsService = getWebSocketClientService();
  private readonly schedulerService = getSchedulerService();
  private unsubscribes: (() => void)[] = [];
  private activeAbort: AbortService | null = null;

  /** Registered agent channels (non-heartbeat). Each gets its own abort & unsubscribe. */
  private readonly agentChannels = new Map<string, AgentChannelState>();

  constructor() {
    this.initialize();
  }

  dispose(): void {
    console.log('[BackendGraphWS] Disposing service, cleaning up', this.unsubscribes.length, 'subscriptions');
    this.unsubscribes.forEach(unsub => unsub());
    this.unsubscribes = [];
    if (this.activeAbort) {
      this.activeAbort.abort();
      this.activeAbort = null;
    }
    // Tear down agent channels
    for (const [, ch] of this.agentChannels) {
      ch.activeAbort?.abort();
      ch.unsubscribe();
    }
    this.agentChannels.clear();
    console.log('[BackendGraphWS] Service disposed');
  }

  private initialize(): void {
    // Initialize heartbeat (dreaming-protocol) channel
    console.log('[BackendGraphWS] Initializing backend channel:', BACKEND_CHANNEL_ID);
    this.wsService.connect(BACKEND_CHANNEL_ID);

    // Register heartbeat agent in the active agents registry
    this.registerAgent().catch(err => console.warn('[BackendGraphWS] Failed to register agent:', err));

    const chatUnsubscribe = this.wsService.onMessage(BACKEND_CHANNEL_ID, (msg) => {
      this.handleWebSocketMessage(msg);
    });
    if (chatUnsubscribe) {
      this.unsubscribes.push(chatUnsubscribe);
    }

    // Initialize calendar event channel
    this.wsService.connect(CALENDAR_CHANNEL_ID);

    const calendarUnsubscribe = this.wsService.onMessage(CALENDAR_CHANNEL_ID, (msg) => {
      this.handleCalendarMessage(msg);
    });
    if (calendarUnsubscribe) {
      this.unsubscribes.push(calendarUnsubscribe);
    }

    // Register the chat-controller agent channel (always handled by the backend
    // so it works regardless of which renderer windows are open).
    this.initAgentChannel(CHAT_CONTROLLER_CHANNEL_ID);

    console.log('[Background] BackendGraphWebSocketService initialized');
  }

  /**
   * Initialize a fixed agent channel. Connects to WS, subscribes to messages,
   * and registers in the active agents registry.
   */
  private initAgentChannel(channelId: string): void {
    console.log('[BackendGraphWS] Initializing agent channel:', channelId);
    this.wsService.connect(channelId);

    const unsub = this.wsService.onMessage(channelId, (msg) => {
      this.handleAgentChannelMessage(channelId, msg);
    });

    if (!unsub) {
      console.warn('[BackendGraphWS] Failed to subscribe to agent channel:', channelId);
      return;
    }

    this.agentChannels.set(channelId, { unsubscribe: unsub, activeAbort: null });

    this.registerAgentInRegistry(channelId).catch(err =>
      console.warn('[BackendGraphWS] Failed to register agent channel:', channelId, err));
  }

  // ------------------------------------------------------------------
  // Heartbeat channel handling (dreaming-protocol)
  // ------------------------------------------------------------------

  private async handleWebSocketMessage(msg: WebSocketMessage): Promise<void> {
    if (msg.type === 'graph_runtime_update') {
      this.handleGraphRuntimeUpdate(msg);
      return;
    }

    if (msg.type === 'stop_run') {
      this.activeAbort?.abort();
      return;
    }

    if (msg.type !== 'user_message') return;

    const data = typeof msg.data === 'string' ? { content: msg.data } : (msg.data as any);
    const content = (data?.content ?? '').trim();
    if (!content) return;

    const threadIdFromMsg = data?.threadId as string | undefined;

    // Scheduler ack
    const metadata = data?.metadata;
    if (metadata?.origin === 'scheduler' && typeof metadata?.eventId === 'number') {
      this.wsService.send(BACKEND_CHANNEL_ID, {
        type: 'scheduler_ack',
        data: { eventId: metadata.eventId },
        timestamp: Date.now(),
      });
    }

    await this.processUserInput(content, threadIdFromMsg);
  }

  private handleGraphRuntimeUpdate(msg: WebSocketMessage): void {
    const data = (msg.data && typeof msg.data === 'object') ? (msg.data as any) : null;
    const threadId = typeof data?.threadId === 'string' ? data.threadId.trim() : '';
    const n8nLiveEventsEnabled = typeof data?.n8nLiveEventsEnabled === 'boolean'
      ? data.n8nLiveEventsEnabled
      : null;

    if (!threadId || n8nLiveEventsEnabled === null) {
      return;
    }

    const updated = GraphRegistry.updateRuntimeFlags(threadId, { n8nLiveEventsEnabled });
    const updatedByStateThreadId = GraphRegistry.updateRuntimeFlagsByStateThreadId(threadId, { n8nLiveEventsEnabled });
    if (!updated && updatedByStateThreadId === 0) {
      console.log('[BackendGraphWS] graph_runtime_update ignored (thread not found):', threadId);
      return;
    }

    console.log('[BackendGraphWS] graph_runtime_update applied:', {
      threadId,
      n8nLiveEventsEnabled,
      updatedByRegistryKey: updated,
      updatedByStateThreadId,
    });
  }

  private async processUserInput(userText: string, threadIdFromMsg?: string): Promise<void> {
    const { graph, state } = await GraphRegistry.getOrCreateOverlordGraph(
      BACKEND_CHANNEL_ID
    ) as { graph: any; state: HeartbeatThreadState };

    const abort = new AbortService();
    this.activeAbort = abort;
    state.metadata.options.abort = abort;

    try {
      if (!threadIdFromMsg) {
        this.wsService.send(BACKEND_CHANNEL_ID, {
          type: 'thread_created',
          data: { threadId: state.metadata.threadId },
          timestamp: Date.now(),
        });
      }

      state.messages.push({
        id: nextMessageId(),
        role: 'user',
        content: userText,
        timestamp: Date.now(),
        metadata: { source: 'user' },
      } as any);

      const resumeNodeId = state.metadata.waitingForUser === true
        ? String(state.metadata.currentNodeId || '').trim()
        : '';
      const shouldResumeFromCurrentNode = !!resumeNodeId && resumeNodeId !== 'input_handler';

      state.metadata.consecutiveSameNode = 0;
      state.metadata.iterations = 0;
      state.metadata.cycleComplete = false;
      state.metadata.waitingForUser = false;

      await graph.execute(state, shouldResumeFromCurrentNode ? resumeNodeId : 'input_handler');

      const summaryContent = state.metadata.finalSummary?.trim() || (state.metadata as any).response?.trim() || '';
      const lastAssistantMessage = [...state.messages]
        .reverse()
        .find(msg => msg.role === 'assistant' && typeof msg.content === 'string' && msg.content.trim());
      const content = summaryContent || (lastAssistantMessage?.content?.trim() || '');

      if (content) {
        this.emitMessage(BACKEND_CHANNEL_ID, 'assistant_message', { role: 'assistant', content });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        this.emitMessage(BACKEND_CHANNEL_ID, 'system_message', 'Execution stopped.');
      } else {
        console.error('[BackendGraphWS] Error:', err);
        this.emitMessage(BACKEND_CHANNEL_ID, 'system_message', `Error: ${err.message || String(err)}`);
      }
    } finally {
      state.metadata.consecutiveSameNode = 0;
      state.metadata.iterations = 0;
      (state.metadata as any).agentLoopCount = 0;
      this.activeAbort = null;
    }
  }

  // ------------------------------------------------------------------
  // Agent channel handling (chat-controller + dynamically registered)
  // ------------------------------------------------------------------

  private async handleAgentChannelMessage(channelId: string, msg: WebSocketMessage): Promise<void> {
    if (msg.type === 'graph_runtime_update') {
      this.handleGraphRuntimeUpdate(msg);
      return;
    }

    if (msg.type === 'stop_run') {
      console.log('[BackendGraphWS] stop_run on agent channel:', channelId);
      const ch = this.agentChannels.get(channelId);
      ch?.activeAbort?.abort();
      return;
    }

    if (msg.type === 'continue_run') {
      console.log('[BackendGraphWS] continue_run on agent channel:', channelId);
      await this.continueAgentGraphExecution(channelId);
      return;
    }

    if (msg.type !== 'user_message') return;

    const data = typeof msg.data === 'string' ? { content: msg.data } : (msg.data as any);
    const content = (data?.content ?? '').trim();
    if (!content) return;

    const threadIdFromMsg = data?.threadId as string | undefined;

    // Scheduler ack
    const metadata = data?.metadata;
    if (metadata?.origin === 'scheduler' && typeof metadata?.eventId === 'number') {
      this.wsService.send(channelId, {
        type: 'scheduler_ack',
        data: { eventId: metadata.eventId },
        timestamp: Date.now(),
      });
    }

    await this.processAgentInput(channelId, content, threadIdFromMsg);
  }

  private async processAgentInput(channelId: string, userText: string, threadIdFromMsg?: string): Promise<void> {
    const threadId = threadIdFromMsg || nextThreadId();
    const { graph, state } = await GraphRegistry.getOrCreateAgentGraph(channelId, threadId) as { graph: any; state: AgentGraphState };

    const ch = this.agentChannels.get(channelId);
    const abort = new AbortService();
    if (ch) ch.activeAbort = abort;
    state.metadata.options.abort = abort;

    // Refresh model context from current settings
    const mode = await SullaSettingsModel.get('modelMode', 'local');
    state.metadata.llmLocal = mode === 'local';
    state.metadata.llmModel = mode === 'remote'
      ? await SullaSettingsModel.get('remoteModel', '')
      : await SullaSettingsModel.get('sullaModel', '');

    try {
      if (!threadIdFromMsg) {
        this.wsService.send(channelId, {
          type: 'thread_created',
          data: { threadId: state.metadata.threadId },
          timestamp: Date.now(),
        });
      }

      state.metadata.wsChannel = channelId;

      state.messages.push({
        id: nextMessageId(),
        role: 'user',
        content: userText,
        timestamp: Date.now(),
        metadata: { source: 'user' },
      } as any);

      const resumeNodeId = state.metadata.waitingForUser === true
        ? String(state.metadata.currentNodeId || '').trim()
        : '';
      const shouldResumeFromCurrentNode = !!resumeNodeId
        && resumeNodeId !== 'input_handler'
        && resumeNodeId !== 'output';

      state.metadata.consecutiveSameNode = 0;
      state.metadata.iterations = 0;
      state.metadata.agentLoopCount = 0;
      state.metadata.cycleComplete = false;
      state.metadata.waitingForUser = false;

      await graph.execute(state, shouldResumeFromCurrentNode ? resumeNodeId : 'input_handler');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[BackendGraphWS] Agent execution aborted on', channelId);
        this.emitMessage(channelId, 'system_message', 'Execution stopped.');
      } else {
        console.error('[BackendGraphWS] Agent error on', channelId, err);
        this.emitMessage(channelId, 'system_message', `Error: ${err.message || String(err)}`);
      }
    } finally {
      state.metadata.consecutiveSameNode = 0;
      state.metadata.iterations = 0;
      state.metadata.agentLoopCount = 0;
      if (ch) ch.activeAbort = null;
    }
  }

  private async continueAgentGraphExecution(channelId: string): Promise<void> {
    // Find the most recent thread for this channel in the GraphRegistry
    // The channel's thread is stored in the graph state's wsChannel
    const ch = this.agentChannels.get(channelId);
    if (!ch) return;

    // Look through the registry for a state with this wsChannel
    // We need to find the active graph for this channel
    let found: { graph: any; state: AgentGraphState } | null = null;
    // The GraphRegistry doesn't expose iteration, so we use the channelId as key
    const existing = GraphRegistry.get(channelId);
    if (existing) {
      found = existing as any;
    }

    if (!found) {
      console.warn('[BackendGraphWS] No existing graph to continue on channel:', channelId);
      return;
    }

    const { graph, state } = found;
    const abort = new AbortService();
    ch.activeAbort = abort;
    state.metadata.options.abort = abort;

    try {
      state.metadata.consecutiveSameNode = 0;
      state.metadata.iterations = 0;
      state.metadata.agentLoopCount = 0;
      state.metadata.cycleComplete = false;
      state.metadata.waitingForUser = false;

      await graph.execute(state, 'agent');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        this.emitMessage(channelId, 'system_message', 'Execution stopped.');
      } else {
        console.error('[BackendGraphWS] Continue error on', channelId, err);
        this.emitMessage(channelId, 'system_message', `Error: ${err.message || String(err)}`);
      }
    } finally {
      state.metadata.consecutiveSameNode = 0;
      state.metadata.iterations = 0;
      state.metadata.agentLoopCount = 0;
      ch.activeAbort = null;
    }
  }

  // ------------------------------------------------------------------
  // Shared helpers
  // ------------------------------------------------------------------

  private emitMessage(channelId: string, type: string, data: unknown): void {
    this.wsService.send(channelId, { type, data, timestamp: Date.now() });
  }

  private async registerAgent(): Promise<void> {
    const { getActiveAgentsRegistry } = await import('./ActiveAgentsRegistry');
    const registry = getActiveAgentsRegistry();
    await registry.register({
      agentId: 'heartbeat',
      name: 'Radius',
      role: 'Autonomous heartbeat agent',
      channel: BACKEND_CHANNEL_ID,
      type: 'heartbeat',
      status: 'running',
      startedAt: Date.now(),
      lastActiveAt: Date.now(),
      description: 'Autonomous heartbeat agent — runs background tasks and projects',
    });
  }

  private async registerAgentInRegistry(channelId: string): Promise<void> {
    const { getActiveAgentsRegistry } = await import('./ActiveAgentsRegistry');
    const registry = getActiveAgentsRegistry();
    await registry.register({
      agentId:      channelId,
      name:         channelId === CHAT_CONTROLLER_CHANNEL_ID ? 'Sulla' : `Agent (${channelId})`,
      role:         'Chat agent',
      channel:      channelId,
      type:         'agent',
      status:       'running',
      startedAt:    Date.now(),
      lastActiveAt: Date.now(),
      description:  `Agent graph executor on channel ${channelId}`,
    });
  }

  private async handleCalendarMessage(msg: WebSocketMessage): Promise<void> {
    const calendarMsg = msg as CalendarWebSocketMessage;

    if (!calendarMsg || typeof calendarMsg.type !== 'string') {
      console.warn('[BackendGraphWS] Invalid calendar message format:', calendarMsg);
      return;
    }

    const { type, event } = calendarMsg;

    if (type === 'scheduled' && event) {
      try {
        this.schedulerService.scheduleEvent(event);
      } catch (err) {
        console.error('[BackendGraphWS] Failed to schedule calendar event:', err);
      }
    } else if (type === 'cancel' && event?.id) {
      try {
        this.schedulerService.cancelEvent(event.id);
      } catch (err) {
        console.error('[BackendGraphWS] Failed to cancel calendar event:', err);
      }
    } else if (type === 'reschedule' && event) {
      try {
        this.schedulerService.rescheduleEvent(event);
      } catch (err) {
        console.error('[BackendGraphWS] Failed to reschedule calendar event:', err);
      }
    }
  }
}

interface CalendarWebSocketMessage {
  type: 'scheduled' | 'cancel' | 'reschedule';
  event?: CalendarEventData;
  id: string;
  timestamp: number;
  channel: string;
}
