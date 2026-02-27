import { BaseLanguageModel, type ChatMessage, type NormalizedResponse, type RemoteProviderConfig, FinishReason } from './BaseLanguageModel';
import { getOllamaService } from './OllamaService';
import { writeLLMConversationEvent } from './LLMConversationFileLogger';

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
    const conversationId = typeof options?.conversationId === 'string' ? options.conversationId : undefined;
    const nodeName = typeof options?.nodeName === 'string' ? options.nodeName : undefined;

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        if (options?.signal?.aborted) throw new Error('Aborted');

        if (attempt > 0) {
          console.log(`[RemoteService] Retry ${attempt}/${this.retryCount} after ${Math.pow(2, attempt-1)}s backoff`);
          await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
        }

        writeLLMConversationEvent({
          direction: 'request',
          provider: this.config.id,
          model: options.model ?? this.model,
          endpoint,
          nodeName,
          conversationId,
          attempt,
          payload: body,
        });

        console.log('[RemoteService:sendRawRequest] body:', body);
        const payload = this.buildFetchOptions(body, options?.signal);
        const res = await fetch(url, payload);

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
            continue;
          }
          throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
        }
        const rawResponse = await res.json();
        writeLLMConversationEvent({
          direction: 'response',
          provider: this.config.id,
          model: options.model ?? this.model,
          endpoint,
          nodeName,
          conversationId,
          attempt,
          payload: rawResponse,
        });

        return rawResponse;
      } catch (err) {
        lastError = err;
        console.log(`[RemoteService] Error on attempt ${attempt}:`, err);
        writeLLMConversationEvent({
          direction: 'error',
          provider: this.config.id,
          model: options.model ?? this.model,
          endpoint,
          nodeName,
          conversationId,
          attempt,
          payload: err instanceof Error ? { message: err.message, stack: err.stack } : err,
        });

        // Do not retry non-rate-limit 4xx client errors (invalid payload, auth, etc.)
        if (err instanceof Error && /HTTP 4\d\d:/.test(err.message) && !err.message.startsWith('HTTP 429:')) {
          break;
        }
      }
    }

    // Final fallback to Ollama
    const ollama = await this.getFallbackLocalService();
    await ollama.initialize();
    if (ollama.isAvailable()) {
      const localModel = ollama.getModel();
      const fallbackOptions = {
        ...(options ?? {}),
        model: localModel,
      };

      const localResponse = await ollama.chat(messages, fallbackOptions);
      if (localResponse) {
        return this.toOpenAiCompatibleRawResponse(localResponse, localModel);
      }
    }

    throw lastError ?? new Error('All retries failed and Ollama unavailable');
  }

  protected async getFallbackLocalService() {
    return getOllamaService();
  }

  private toOpenAiCompatibleRawResponse(localResponse: NormalizedResponse, model: string): any {
    const toolCalls = localResponse.metadata.tool_calls?.map((tc) => ({
      id: tc.id,
      type: 'function',
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.args ?? {}),
      },
    }));

    return {
      choices: [
        {
          message: {
            content: localResponse.content,
            ...(toolCalls?.length ? { tool_calls: toolCalls } : {}),
          },
          finish_reason: localResponse.metadata.finish_reason ?? FinishReason.Stop,
        },
      ],
      usage: {
        prompt_tokens: localResponse.metadata.prompt_tokens ?? 0,
        completion_tokens: localResponse.metadata.completion_tokens ?? 0,
        total_tokens: localResponse.metadata.tokens_used
          ?? ((localResponse.metadata.prompt_tokens ?? 0) + (localResponse.metadata.completion_tokens ?? 0)),
      },
      model,
    };
  }

  /**
   * Build provider-specific request body.
   * Tool results persist natively in state.messages as proper tool_use/tool_result
   * content arrays and are passed through as-is for Anthropic.
   */
  private buildRequestBody(messages: ChatMessage[], options: any, overrides: any): any {
    // Sanitize messages: preserve native content arrays (tool_use/tool_result blocks),
    // trim string content, strip role:tool legacy messages.
    const sanitizedMessages = messages
      .filter(m => m.role !== 'tool')
      .map(m => {
        if (Array.isArray(m.content)) {
          // Native content array (tool_use or tool_result blocks) — pass through as-is
          return { ...m };
        }
        return {
          ...m,
          content: typeof m.content === 'string' ? m.content.trim() : String(m.content ?? '').trim(),
        };
      })
      .filter(m => {
        if (Array.isArray(m.content)) return m.content.length > 0;
        return typeof m.content === 'string' && m.content.length > 0;
      });

    // ── Anthropic ─────────────────────────────────────────────────────────────
    if (this.config.id === 'anthropic') {
      const systemMessage = sanitizedMessages.find(m => m.role === 'system');

      let processedMessages: any[] = sanitizedMessages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));

      // Anthropic requires the final turn to be a user message.
      // If tool_use/tool_result pairs are stored properly this should rarely fire.
      const lastProcessedMessage = processedMessages[processedMessages.length - 1];
      if (!lastProcessedMessage || lastProcessedMessage.role !== 'user') {
        processedMessages.push({ role: 'user', content: 'continue' });
      }

      const anthropicBody: any = {
        model: this.model,
        max_tokens: options.maxTokens ?? 1024,
        messages: processedMessages,
      };

      if (systemMessage?.content) {
        anthropicBody.system = systemMessage.content;
      }

      if (options.tools?.length) {
        anthropicBody.tools = options.tools.map((tool: any) => {
          if (tool.type === 'function') {
            return {
              type: 'custom',
              name: tool.function.name,
              description: tool.function.description,
              input_schema: tool.function.parameters || { type: 'object', properties: {} },
            };
          }
          return tool;
        });
      }

      return anthropicBody;
    }

    // ── Google ────────────────────────────────────────────────────────────────
    if (this.config.id === 'google') {
      const contents: any[] = sanitizedMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : m.role,
        parts: Array.isArray(m.content) ? [{ text: JSON.stringify(m.content) }] : [{ text: m.content }],
      }));

      return {
        contents,
        generationConfig: { maxOutputTokens: options.maxTokens },
      };
    }

    // ── OpenAI / Grok / Azure / Mistral / Groq (OpenAI-compatible) ───────────
    const baseMessages: any[] = sanitizedMessages.map(m => ({ role: m.role, content: m.content }));

    const baseBody: any = {
      model: options.model ?? this.model,
      messages: baseMessages,
    };

    if (options.maxTokens) {
      baseBody.max_tokens = options.maxTokens;
    }

    if (options.tools?.length) {
      baseBody.tools = options.tools;
    }

    if (options.format === 'json') {
      baseBody.response_format = { type: 'json_object' };
    }

    return baseBody;
  }

  /**
   * Override buildFetchOptions to handle provider-specific authentication.
   */
  protected buildFetchOptions(body: any, signal?: AbortSignal): RequestInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const overrides = this.providerOverrides[this.config.id] || {};
    
    if (this.apiKey) {
      if (overrides.authHeader === 'x-api-key') {
        // Anthropic uses x-api-key header
        headers['x-api-key'] = this.apiKey;
        // Add required anthropic-version header
        if (this.config.id === 'anthropic') {
          headers['anthropic-version'] = '2023-06-01';
        }
      } else {
        // Default to Bearer token for other providers
        headers.Authorization = `Bearer ${this.apiKey}`;
      }
    }

    return {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    };
  }

}

// Factory helper
export function createRemoteModelService(config: RemoteProviderConfig): RemoteModelService {
  return new RemoteModelService(config);
}