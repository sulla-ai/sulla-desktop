// ChatInterface.ts
import { ref, computed, watch } from 'vue';
import { getAgentPersonaRegistry, type ChatMessage as RegistryChatMessage } from '@pkg/agent';

export type ChatMessage = RegistryChatMessage;

export class ChatInterface {
  private readonly registry = getAgentPersonaRegistry();
  private activeAgentId = ref<string>('chat-controller');

  private unsubscribeActiveAgent: (() => void) | null = null;

  readonly query = ref('');
  readonly transcriptEl = ref<HTMLElement | null>(null);

  readonly currentAgentId = computed(() => this.activeAgentId.value);

  readonly messages = ref<ChatMessage[]>([]);

  constructor() {
    this.unsubscribeActiveAgent = this.registry.onActiveAgentChange(agent => {
      this.activeAgentId.value = agent?.agentId || 'chat-controller';
      this.updateMessages();
    });

    watch(() => this.registry.getActivePersonaService()?.messages.length ?? 0, () => {
      this.updateMessages();
    });

    this.updateMessages();
  }

  private updateMessages(): void {
    const persona = this.registry.getActivePersonaService();
    this.messages.value = persona ? [...persona.messages] : [];
  }


  // Graph running state from active agent's persona service
  readonly graphRunning = computed(() => {
    const personaService = this.registry.getActivePersonaService();
    if (!personaService) {
      return false;
    }
    return personaService.graphRunning.value;
  });

  // Track if user has ever sent a message (persisted in localStorage)
  private readonly hasSentMessageKey = 'chat_has_sent_message';
  private hasSentMessage = ref(localStorage.getItem(this.hasSentMessageKey) === 'true');

  readonly hasMessages = computed(() => {
    // True if user has ever sent a message OR if current session has messages
    return this.hasSentMessage.value || this.messages.value.length > 0;
  });

  private subscribedThreadId: string | null = null;

  /**
   * Clean up event subscriptions
   */
  dispose(): void {
    if (this.unsubscribeActiveAgent) {
      this.unsubscribeActiveAgent();
      this.unsubscribeActiveAgent = null;
    }
  }

  stop(): void {
    const personaService = this.registry.getActivePersonaService();
    if (personaService) {
      personaService.emitStopSignal(personaService.state.agentId);
      personaService.graphRunning.value = false;
      this.registry.setLoading(personaService.state.agentId, false);
    }
  }

  async send(): Promise<void> {
    if (!this.query.value.trim()) return;

    const text = this.query.value;
    this.query.value = '';

    if (!this.hasSentMessage.value) {
      this.hasSentMessage.value = true;
      localStorage.setItem(this.hasSentMessageKey, 'true');
    }

    const persona = this.registry.getActivePersonaService();
    if (!persona) {
      console.warn('[ChatInterface] No active persona');
      return;
    }

    // New clean signature
    await persona.addUserMessage('', text);   // first arg is now ignored
  }
}