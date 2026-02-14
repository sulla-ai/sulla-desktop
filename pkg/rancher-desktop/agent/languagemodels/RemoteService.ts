import { BaseLanguageModel, type ChatMessage, type NormalizedResponse, type RemoteProviderConfig, FinishReason } from './BaseLanguageModel';
import { getOllamaService } from './OllamaService';

/**
 * Remote LLM provider service (OpenAI-compatible + Anthropic + others).
 *
 * Extends BaseLanguageModel to handle remote API calls with:
 * - Provider-specific endpoint mapping
 * - Automatic retry on 429/5xx (configurable)
 * - Fallback to local Ollama on final failure
 * - Normalized token usage & timing
 *
 * @extends BaseLanguageModel
 */
export class RemoteModelService extends BaseLanguageModel {
  protected config: RemoteProviderConfig;
  private retryCount = 3;
  private defaultTimeoutMs = 60_000;

  // Provider-specific overrides
  private providerOverrides: Record<string, Partial<{ chatEndpoint: string; authHeader: string; modelKey: string }>> = {
    grok:      { chatEndpoint: '/chat/completions' },
    openai:    { chatEndpoint: '/chat/completions' },
    anthropic: { chatEndpoint: '/messages', authHeader: 'x-api-key', modelKey: 'model' },
    google:    { chatEndpoint: `/models/${this.model}:generateContent` },
    kimi:      { chatEndpoint: '/chat/completions' },
    nvidia:    { chatEndpoint: '/chat/completions' },
  };

  constructor(config: RemoteProviderConfig) {
    super(config);
    this.config = config;
    this.model = config.model;
    this.apiKey = config.apiKey;
  }

  /**
   * Set number of retries on rate-limit/server errors.
   */
  public setRetryCount(count: number): void {
    this.retryCount = Math.max(0, Math.min(10, count));
  }

  /**
   * Lightweight health check — verifies config presence.
   * Override in subclass for real ping if needed.
   * @override
   */
  protected async healthCheck(): Promise<boolean> {
    return !!this.apiKey && !!this.baseUrl;
  }

  /**
   * Send request to remote provider with fallback logic.
   * @override
   */
  protected async sendRawRequest(messages: ChatMessage[], options: any): Promise<any> {
    const overrides = this.providerOverrides[this.config.id] || {};
    const endpoint = overrides.chatEndpoint ?? '/chat/completions';
    const url = `${this.baseUrl}${endpoint}`;

    const body: any = this.buildRequestBody(messages, options, overrides);

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        if (options?.signal?.aborted) throw new Error('Aborted');

        if (attempt > 0) {
          console.log(`[RemoteService] Retry ${attempt}/${this.retryCount} after ${Math.pow(2, attempt-1)}s backoff`);
          await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
        }

        const payload = this.buildFetchOptions(body, options?.signal);
        console.log('[RemoteService] Payload:', payload);
        const res = await fetch(url, payload);

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
            continue;
          }
          throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
        }

        return await res.json();
      } catch (err) {
        lastError = err;
        console.log(`[RemoteService] Error on attempt ${attempt}:`, err);
      }
    }

    // Final fallback to Ollama
    const ollama = await getOllamaService();
    await ollama.initialize();
    if (ollama.isAvailable()) {
      return ollama.chat(messages, options); // will normalize internally
    }

    throw lastError ?? new Error('All retries failed and Ollama unavailable');
  }

  /**
   * Build provider-specific request body.
   */
  private buildRequestBody(messages: ChatMessage[], options: any, overrides: any): any {
    const baseBody: any = {
      model: options.model ?? this.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    };

    if (options.maxTokens) {
      baseBody.max_tokens = options.maxTokens;
    }

    // Add tools when provided (OpenAI / Grok / most compatible)
    if (options.tools?.length) {
      baseBody.tools = options.tools.map((tool: any) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.schema ? tool.schema.shape : tool.function?.parameters,
        }
      }));
    }

    if (options.format === 'json') {
      baseBody.response_format = { type: 'json_object' };
    }

    // Anthropic shape (uses tools array differently)
    if (this.config.id === 'anthropic') {
      const anthropicBody: any = {
        model: this.model,
        max_tokens: options.maxTokens ?? 1024,
        messages: messages.map(m => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content })),
        system: messages.find(m => m.role === 'system')?.content,
      };

      if (options.tools?.length) {
        anthropicBody.tools = options.tools.map((tool: any) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.schema ? tool.schema.shape : tool.function?.parameters,
        }));
      }

      return anthropicBody;
    }

    // Google (no native tools yet — skip or use extensions if needed)
    if (this.config.id === 'google') {
      return {
        contents: messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : m.role,
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: options.maxTokens },
      };
    }

    return baseBody;
  }

}

// Factory helper
export function createRemoteModelService(config: RemoteProviderConfig): RemoteModelService {
  return new RemoteModelService(config);
}