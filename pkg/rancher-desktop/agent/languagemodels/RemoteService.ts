import { BaseLanguageModel, type ChatMessage, type NormalizedResponse, type RemoteProviderConfig } from './BaseLanguageModel';
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
  private config: RemoteProviderConfig;
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
    const ollama = getOllamaService();
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

    if (options.format === 'json') {
      // OpenAI-style
      baseBody.response_format = { type: 'json_object' };
    }

    // Anthropic needs different shape
    if (this.config.id === 'anthropic') {
      return {
        model: this.model,
        max_tokens: options.maxTokens ?? 1024,
        messages: messages.map(m => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content })),
        system: messages.find(m => m.role === 'system')?.content,
      };
    }

    // Google Gemini needs different structure
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

  /**
   * Normalize response across providers.
   * @override
   */
  protected normalizeResponse(raw: any): NormalizedResponse {
    // Already has OpenAI-style fallback in base class
    // Add provider-specific extraction if needed
    let content = '';
    let usage: any = {};

    if (this.config.id === 'anthropic') {
      content = raw.content?.[0]?.text ?? '';
      usage = raw.usage ?? {};
    } else if (this.config.id === 'google') {
      content = raw.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      usage = raw.usageMetadata ?? {};
    } else {
      // OpenAI-compatible default
      content = raw.choices?.[0]?.message?.content ?? '';
      usage = raw.usage ?? {};
    }

    return {
      content: content.trim(),
      metadata: {
        tokens_used: (usage.total_tokens ?? usage.output_tokens ?? 0) + (usage.prompt_tokens ?? usage.input_tokens ?? 0),
        time_spent: 0, // overridden by wall-clock in chat()
        prompt_tokens: usage.prompt_tokens ?? usage.input_tokens ?? 0,
        completion_tokens: usage.completion_tokens ?? usage.output_tokens ?? 0,
        model: this.model,
      },
    };
  }
}

// Factory helper
export function createRemoteModelService(config: RemoteProviderConfig): RemoteModelService {
  return new RemoteModelService(config);
}