import { computed, nextTick, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import type { ConversationThread } from '@pkg/agent/ConversationThread';
import type { AgentResponse, SensoryInput, ThreadContext } from '@pkg/agent/types';

import type { StartupProgressController } from './StartupProgressController';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
};

export class AgentChatController {
  readonly query = ref('');
  readonly loading = ref(false);
  readonly messages = ref<ChatMessage[]>([]);
  readonly transcriptEl = ref<HTMLElement | null>(null);
  readonly hasMessages: ComputedRef<boolean> = computed(() => this.messages.value.length > 0);

  constructor(private readonly deps: {
    systemReady: Ref<boolean>;
    currentThreadId: Ref<string | null>;

    sensory: { createTextInput: (text: string) => SensoryInput };
    contextDetector: { detect: (input: SensoryInput, threadId?: string) => Promise<ThreadContext> };
    getThread: (threadId: string) => ConversationThread;
    responseHandler: {
      hasErrors: (resp: AgentResponse) => boolean;
      getError: (resp: AgentResponse) => string | null | undefined;
      formatText: (resp: AgentResponse) => string | undefined;
    };

    startupProgress: StartupProgressController;
  }) {
  }

  async send(): Promise<void> {
    if (!this.query.value.trim() || this.loading.value || !this.deps.systemReady.value) {
      return;
    }

    const userText = this.query.value;
    this.query.value = '';
    this.messages.value.push({ id: `${Date.now()}_user`, role: 'user', content: userText });
    await this.scrollTranscriptToBottom();

    this.loading.value = true;

    try {
      const input = this.deps.sensory.createTextInput(userText);

      const threadContext = await this.deps.contextDetector.detect(
        input,
        this.deps.currentThreadId.value || undefined,
      );

      this.deps.currentThreadId.value = threadContext.threadId;

      const thread = this.deps.getThread(threadContext.threadId);
      await thread.initialize();

      const agentResponse = await thread.process(input);

      if (this.deps.responseHandler.hasErrors(agentResponse)) {
        const err = this.deps.responseHandler.getError(agentResponse);
        throw new Error(err || 'Unknown error');
      }

      const formatted = this.deps.responseHandler.formatText(agentResponse) || 'No response from model';
      this.messages.value.push({ id: `${Date.now()}_assistant`, role: 'assistant', content: formatted });
      await this.scrollTranscriptToBottom();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      const recovered = await this.deps.startupProgress.handleOllamaMemoryError(message);

      if (recovered) {
        this.messages.value.push({
          id:      `${Date.now()}_error`,
          role:    'error',
          content: 'Restarting AI service to free memory. Please try again in a moment.',
        });
      } else {
        this.messages.value.push({ id: `${Date.now()}_error`, role: 'error', content: `Error: ${message}` });
      }

      await this.scrollTranscriptToBottom();
    } finally {
      this.loading.value = false;
    }
  }

  private async scrollTranscriptToBottom(): Promise<void> {
    await nextTick();
    const el = this.transcriptEl.value;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }
}
