import type { Ref } from 'vue';
import type { SkillGraphState } from '../nodes/Graph';
import { getWebSocketClientService, type WebSocketMessage } from './WebSocketClientService';
import { AbortService } from './AbortService';
import { GraphRegistry, nextThreadId, nextMessageId } from './GraphRegistry';
import { SullaSettingsModel } from '../database/models/SullaSettingsModel';

export type FrontendGraphWebSocketDeps = {
  currentThreadId: Ref<string | null>;
};

export class FrontendGraphWebSocketService {
  private readonly wsService = getWebSocketClientService();
  private unsubscribe: (() => void) | null = null;
  private activeAbort: AbortService | null = null;

  constructor(private readonly deps: FrontendGraphWebSocketDeps) {
    this.initialize();
  }

  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.activeAbort) {
      this.activeAbort.abort();
      this.activeAbort = null;
    }
  }

  private initialize(): void {
    this.wsService.connect('chat-controller');
    this.unsubscribe = this.wsService.onMessage('chat-controller', (msg) => {
      this.handleWebSocketMessage(msg);
    });
  }

  private async handleWebSocketMessage(msg: WebSocketMessage): Promise<void> {
    if (msg.type === 'stop_run') {
      console.log('[FrontendGraphWS] stop_run received');
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
      this.wsService.send('chat-controller', {
        type: 'scheduler_ack',
        data: { eventId: metadata.eventId },
        timestamp: Date.now(),
      });
    }

    await this.processUserInput(content, threadIdFromMsg);
  }

  private async processUserInput(userText: string, threadIdFromMsg?: string): Promise<void> {
    const channelId = 'chat-controller';
    const threadId = threadIdFromMsg || nextThreadId();
    
    // Get or create persistent SkillGraph for this thread - do this outside try/catch
    const { graph, state } = await GraphRegistry.getOrCreateSkillGraph(channelId, threadId) as { graph: any; state: SkillGraphState };

    // Create a fresh AbortService for this run and wire it into state
    const abort = new AbortService();
    this.activeAbort = abort;
    state.metadata.options.abort = abort;

    // Always refresh model context from current settings so existing threads
    // follow the currently selected frontend model/provider.
    const mode = await SullaSettingsModel.get('modelMode', 'local');
    state.metadata.llmLocal = mode === 'local';
    state.metadata.llmModel = mode === 'remote'
      ? await SullaSettingsModel.get('remoteModel', 'grok-4-1-fast-reasoning')
      : await SullaSettingsModel.get('sullaModel', 'tinyllama:latest');

    try {

      // === NEW: Notify AgentPersonaService about the threadId ===
      if (!threadIdFromMsg) {
        this.wsService.send(channelId, {
          type: 'thread_created',
          data: {
            threadId: state.metadata.threadId
          },
          timestamp: Date.now()
        });
      }

      // Update local ref (for UI)
      if (!this.deps.currentThreadId.value) {
        this.deps.currentThreadId.value = threadId;
      }

      state.metadata.wsChannel = channelId;

      // Append new user message
      const newMsg = {
        id: nextMessageId(),
        role: 'user',
        content: userText,
        timestamp: Date.now(),
        metadata: { source: 'user' }
      };
      state.messages.push(newMsg as any);

      // Reset pause flags when real user input comes in
      const resumeNodeId = state.metadata.waitingForUser === true
        ? String(state.metadata.currentNodeId || '').trim()
        : '';
      const shouldResumeFromCurrentNode = !!resumeNodeId && resumeNodeId !== 'input_handler';

      state.metadata.cycleComplete = false;
      state.metadata.waitingForUser = false;

      // Execute on the persistent SkillGraph starting from input_handler
      // The graph nodes (especially OutputNode) will send WebSocket messages directly
      await graph.execute(state, shouldResumeFromCurrentNode ? resumeNodeId : 'input_handler');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[FrontendGraphWS] Execution aborted');
        this.emitSystemMessage('Execution stopped.');
      } else {
        console.error('[FrontendGraphWS] Error:', err);
        this.emitSystemMessage(`Error: ${err.message || String(err)}`);
      }
    } finally {
      // Reset here — after graph run completes
      state.metadata.consecutiveSameNode = 0;
      state.metadata.iterations = 0;
      this.activeAbort = null;
    }
  }

  private emitAssistantMessage(content: string): void {
    this.wsService.send('chat-controller', {
      type: 'assistant_message',
      data: { role: 'assistant', content },
      timestamp: Date.now(),
    });
  }

  private emitSystemMessage(content: string): void {
    this.wsService.send('chat-controller', {
      type: 'system_message',
      data: content,
      timestamp: Date.now(),
    });
  }
}