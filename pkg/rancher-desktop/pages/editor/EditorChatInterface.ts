// EditorChatInterface.ts — Chat controller that uses the active agent from the registry
import { ref, watch, computed } from 'vue';
import { getAgentPersonaRegistry, type ChatMessage } from '@pkg/agent';

export class EditorChatInterface {
  private readonly registry = getAgentPersonaRegistry();

  readonly query = ref('');
  readonly messages = ref<ChatMessage[]>([]);

  private watcher: ReturnType<typeof watch> | null = null;

  private get activeAgentId(): string {
    return this.registry.state.activeAgentId;
  }

  readonly graphRunning = computed(() => {
    const persona = this.registry.getPersonaService(this.activeAgentId);
    return persona?.graphRunning.value ?? false;
  });

  readonly loading = computed(() => {
    return this.registry.isLoading(this.activeAgentId);
  });

  constructor() {
    // Watch active agent's messages and mirror into our ref
    this.watcher = watch(
      () => {
        const persona = this.registry.getPersonaService(this.activeAgentId);
        return persona?.messages.length ?? 0;
      },
      () => this.updateMessages(),
    );

    // Also re-sync messages when active agent changes
    watch(() => this.registry.state.activeAgentId, () => this.updateMessages());

    this.updateMessages();
  }

  private updateMessages(): void {
    const persona = this.registry.getPersonaService(this.activeAgentId);
    this.messages.value = persona ? [...persona.messages] : [];
  }

  async send(): Promise<void> {
    const text = this.query.value.trim();
    if (!text) return;

    this.query.value = '';

    const persona = this.registry.getPersonaService(this.activeAgentId);
    if (!persona) {
      console.warn(`[EditorChatInterface] No persona service for ${this.activeAgentId}`);
      return;
    }

    await persona.addUserMessage('', text);
  }

  stop(): void {
    const agentId = this.activeAgentId;
    const persona = this.registry.getPersonaService(agentId);
    if (persona) {
      persona.emitStopSignal(agentId);
      persona.graphRunning.value = false;
      this.registry.setLoading(agentId, false);
    }
  }

  dispose(): void {
    if (this.watcher) {
      this.watcher();
      this.watcher = null;
    }
  }
}
