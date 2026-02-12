import { ref, computed, watch } from 'vue';

import { getAgentPersonaRegistry, type ChatMessage as RegistryChatMessage } from '@pkg/agent';

export type ChatMessage = RegistryChatMessage;

type SidebarTodoStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

type SidebarTodo = {
  key: string;
  title: string;
  status: SidebarTodoStatus;
  statusLabel: string;
};

function normalizeStatus(status: string): SidebarTodoStatus {
  if (status === 'in_progress' || status === 'done' || status === 'blocked') {
    return status;
  }
  return 'pending';
}

function makeStatusLabel(status: SidebarTodoStatus): string {
  switch (status) {
  case 'in_progress':
    return 'In progress';
  case 'done':
    return 'Completed';
  case 'blocked':
    return 'Blocked';
  default:
    return 'Pending';
  }
}

export class ChatInterface {
  private readonly frontendChannelId = 'chat-controller';
  private readonly backendChannelId = 'dreaming-protocol';

  readonly query = ref('');
  readonly transcriptEl = ref<HTMLElement | null>(null);

  private registry = getAgentPersonaRegistry();
  private activeAgentId = ref<string>(this.frontendChannelId);
  private unsubscribeActiveAgent: (() => void) | null = null;

  // Expose active agent ID for UI
  readonly currentAgentId = computed(() => this.activeAgentId.value);

  // Plan state - derived from active agent's persona service
  readonly activePlanId = computed(() => {
    const personaService = this.registry.getActivePersonaService();
    const planId = personaService?.planState.planId ?? null;
    return planId;
  });
  
  readonly activePlanGoal = computed(() => {
    const personaService = this.registry.getActivePersonaService();
    const goal = personaService?.planState.goal ?? null;
    return goal;
  });

  readonly activePlanTodos = computed<SidebarTodo[]>(() => {
    const personaService = this.registry.getActivePersonaService();
    if (!personaService) {
      return [];
    }

    const order = personaService.planState.todoOrder;
    const todos = personaService.planState.todos;
    
    const result = order
      .map((id: number) => {
        const todo = todos.get(id);
        if (!todo) {
          return null;
        }

        return {
          key: String(id),
          title: todo.title,
          status: normalizeStatus(todo.status),
          statusLabel: makeStatusLabel(normalizeStatus(todo.status)),
        };
      })
      .filter((x: SidebarTodo | null): x is SidebarTodo => !!x);
    
    return result;
  });

  // Messages from active agent's persona service
  readonly messages = ref<ChatMessage[]>([]);

  constructor() {
    console.log('[ChatInterface] Constructor called');

    this.unsubscribeActiveAgent = this.registry.onActiveAgentChange((agent) => {
      const newAgentId = agent?.agentId || this.frontendChannelId;
      this.activeAgentId.value = newAgentId;
      // Update messages when active agent changes
      this.updateMessages();
    });

    // Watch for received messages from the current active persona service
    watch(() => {
      const personaService = this.registry.getActivePersonaService();
      return personaService?.messages.length ?? 0;
    }, (newLength, oldLength) => {
      console.log('[ChatInterface] Watcher triggered: newLength=', newLength, 'oldLength=', oldLength);
      this.updateMessages();
    });

    // Initial messages update
    this.updateMessages();
  }

  private updateMessages(): void {
    const personaService = this.registry.getActivePersonaService();
    if (!personaService) {
      console.log('[ChatInterface] updateMessages: no personaService');
      this.messages.value = [];
      return;
    }
    const msgs = personaService.messages;
    console.log('[ChatInterface] updateMessages: setting', msgs.length, 'messages');
    console.log('[ChatInterface] Messages content:', msgs.map(m => ({ role: m.role, content: m.content.slice(0, 100) + '...' })));
    this.messages.value = [...msgs];
    console.log('[ChatInterface] Messages set to', this.messages.value.length, 'messages');
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
      this.registry.setLoading(personaService.state.agentId, false);
    }
  }

  async send(): Promise<void> {
    if (!this.query.value.trim()) {
      return;
    }

    const channelId = this.activeAgentId.value;
    const userText = this.query.value;
    this.query.value = '';

    // Mark that user has sent a message (persisted across sessions)
    if (!this.hasSentMessage.value) {
      this.hasSentMessage.value = true;
      localStorage.setItem(this.hasSentMessageKey, 'true');
    }

    const maxRetries = 5;
    const retryDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const personaService = this.registry.getActivePersonaService();
        if (!personaService) {
          console.warn(`[ChatInterface] Attempt ${attempt}: No active persona service, retrying in ${retryDelay}ms`);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          } else {
            console.error('[ChatInterface] Failed to send message after all retries: No active persona service');
            return;
          }
        }

        personaService.addUserMessage(this.activeAgentId.value, userText);
        // Update UI immediately after sending
        this.updateMessages();
        console.log(`[ChatInterface] Message sent successfully on attempt ${attempt}`);
        return;
      } catch (error) {
        console.warn(`[ChatInterface] Attempt ${attempt} failed:`, error);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          console.error(`[ChatInterface] Failed to send message after ${maxRetries} attempts:`, error);
        }
      }
    }
  }

}
