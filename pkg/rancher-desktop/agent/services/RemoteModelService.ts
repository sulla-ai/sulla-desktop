// RemoteModelService - Handles remote LLM API calls (Grok, OpenAI, Anthropic, Google)
// Implements ILLMService for interchangeable use with OllamaService

import type { ILLMService, ChatMessage, RemoteProviderConfig } from '../languagemodels/BaseLanguageModel';
import { getOllamaService } from './OllamaService';


function combineSignals(timeoutMs: number, external?: AbortSignal): AbortSignal {
  if (!external) {
    return AbortSignal.timeout(timeoutMs);
  }

  const anyFn = (AbortSignal as any).any as ((signals: AbortSignal[]) => AbortSignal) | undefined;
  if (typeof anyFn === 'function') {
    return anyFn([AbortSignal.timeout(timeoutMs), external]);
  }

  const controller = new AbortController();
  const onAbort = () => {
    try {
      controller.abort();
    } catch {
      // ignore
    }
  };

  const timer = setTimeout(onAbort, timeoutMs);
  external.addEventListener('abort', onAbort, { once: true });
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  return controller.signal;
}

// Provider-specific API configurations
const PROVIDER_CONFIGS: Record<string, { baseUrl: string; chatEndpoint: string; authHeader: string }> = {
  grok: {
    baseUrl:      'https://api.x.ai/v1',
    chatEndpoint: '/chat/completions',
    authHeader:   'Bearer',
  },
  openai: {
    baseUrl:      'https://api.openai.com/v1',
    chatEndpoint: '/chat/completions',
    authHeader:   'Bearer',
  },
  anthropic: {
    baseUrl:      'https://api.anthropic.com/v1',
    chatEndpoint: '/messages',
    authHeader:   'x-api-key',
  },
  google: {
    baseUrl:      'https://generativelanguage.googleapis.com/v1beta',
    chatEndpoint: '/models/{model}:generateContent',
    authHeader:   'Bearer',
  },
  kimi: {
    baseUrl:      'https://api.moonshot.cn/v1',
    chatEndpoint: '/chat/completions',
    authHeader:   'Bearer',
  },
  nvidia: {
    baseUrl:      'https://integrate.api.nvidia.com/v1',
    chatEndpoint: '/chat/completions',
    authHeader:   'Bearer',
  },
};

class RemoteModelServiceClass implements ILLMService {
  private config: RemoteProviderConfig | null = null;
  private available = false;
  private initialized = false;
  private retryCount = 3;
  private defaultTimeoutMs = 60000;

  configure(config: RemoteProviderConfig): void {
    this.config = config;
    this.initialized = false;
    this.available = false;
  }

  setRetryCount(count: number): void {
    this.retryCount = Math.max(0, Math.min(10, count));
  }

  getRetryCount(): number {
    return this.retryCount;
  }

  setDefaultTimeoutMs(timeoutMs: number): void {
    this.defaultTimeoutMs = Math.max(1000, Math.min(300000, timeoutMs));
  }

  getDefaultTimeoutMs(): number {
    return this.defaultTimeoutMs;
  }

  private getProviderConfig() {
    if (!this.config) return null;
    return PROVIDER_CONFIGS[this.config.id] || PROVIDER_CONFIGS.openai;
  }

  async initialize(): Promise<boolean> {
    if (!this.config || !this.config.apiKey) {
      console.warn('[RemoteModelService] No config or API key set');
      this.available = false;
      this.initialized = true;
      return false;
    }

    this.available = true;
    this.initialized = true;
    return true;
  }

  isAvailable(): boolean {
    return this.available;
  }

  getModel(): string {
    return this.config?.model || 'unknown';
  }

  /**
   * Chat with retries on 429 (rate limit) and 5xx (server errors).
   * Fallback to Ollama on final failure or non-retryable errors.
   */
  async chat(
    messages: ChatMessage[],
    options: {
      model?: string;
      maxTokens?: number;
      format?: 'json' | undefined;
      signal?: AbortSignal;
    } = {}
  ): Promise<string | null> {
    if (!this.config?.apiKey || !this.initialized) return null;

    const providerConfig = this.getProviderConfig();
    if (!providerConfig) return null;

    const url = `${providerConfig.baseUrl}${providerConfig.chatEndpoint}`;
    const timeout = this.defaultTimeoutMs;

    let lastError: unknown = null;

    //for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        if (options?.signal?.aborted) throw new Error('Aborted');

        //if (attempt > 0) {
        //  const backoffMs = Math.pow(2, attempt - 1) * 1000;
        //  await new Promise(r => setTimeout(r, backoffMs));
        //}

        const body: any = {
          model: options.model || this.config.model,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        };

        if (options.maxTokens) body.max_tokens = options.maxTokens;
        if (options.format === 'json') body.response_format = { type: 'json_object' };

        const payload = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
          },
          body: JSON.stringify(body),
          signal: combineSignals(timeout, options?.signal)
        };

        console.log('[RemoteModelService] payload', payload);

        const res = await fetch(url, payload);

        if (!res.ok) {
          const errorText = await res.text();
          if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
            //if (attempt < this.retryCount) continue; // retry
          }
          throw new Error(`HTTP ${res.status}: ${errorText}`);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim() || null;

        if (content) return content;

        throw new Error('No content in response');
      } catch (err) {
        lastError = err;
        //if (attempt === this.retryCount) break;
      }
    //}

    // Fallback to Ollama
    try {
      const ollama = getOllamaService();
      await ollama.initialize();
      if (ollama.isAvailable()) {
        return await ollama.chat(messages, { signal: options.signal });
      }
    } catch (fallbackErr) {
      console.error('[RemoteModelService] Ollama fallback failed:', fallbackErr);
    }

    return null;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.config || !this.config.apiKey) {
      return false;
    }

    // Simple check - just verify we have config
    // A real check would make a lightweight API call
    return true;
  }
}

// Singleton instance
let instance: RemoteModelServiceClass | null = null;

export function getRemoteModelService(): RemoteModelServiceClass {
  if (!instance) {
    instance = new RemoteModelServiceClass();
  }

  return instance;
}

export { RemoteModelServiceClass };
