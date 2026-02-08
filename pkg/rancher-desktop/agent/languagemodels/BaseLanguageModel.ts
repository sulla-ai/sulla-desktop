// ILLMService - Common interface for all LLM services (local and remote)
// This allows the agent to use either Ollama or remote APIs interchangeably

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  metadata?: Record<string, any>;
}

/**
 * Normalized response that all LLM services return
 */
export interface NormalizedResponse {
  content: string;
  metadata: {
    tokens_used: number;
    time_spent: number;           // milliseconds
    prompt_tokens?: number;
    completion_tokens?: number;
    model?: string;
  };
}

/**
 * Remote provider configuration
 */
export interface RemoteProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * Overall LLM configuration
 */
export interface LLMConfig {
  mode: 'local' | 'remote';
  // Local
  localModel: string;
  ollamaBase: string;
  localTimeoutSeconds?: number;
  localRetryCount?: number;
  // Remote
  remoteProvider?: string;
  remoteModel?: string;
  remoteApiKey?: string;
  remoteBaseUrl?: string;
  remoteRetryCount?: number;
  remoteTimeoutSeconds?: number;
  // Backend heartbeat model selection
  heartbeatModel?: 'default' | 'local' | 'remote';
}

/**
 * Abstract base class for all LLM providers (local Ollama, OpenAI-compatible APIs, Anthropic, Groq, xAI, etc.).
 *
 * Provides:
 * - Unified chat interface
 * - Response normalization across providers
 * - Health checks & availability tracking
 * - Built-in timeout/abort signal support
 * - Wall-clock timing & token usage metadata
 *
 * Extend this class for each provider:
 * - Implement `sendRawRequest()` → makes the actual HTTP call
 * - Override `healthCheck()` when provider-specific ping is needed
 * - Optionally override `normalizeResponse()` for exotic shapes
 *
 * @example
 * class OllamaService extends BaseLanguageModel {
 *   protected async sendRawRequest(messages: ChatMessage[], options: any) {
 *     return fetch(`${this.baseUrl}/api/chat`, this.buildFetchOptions({
 *       model: options.model,
 *       messages,
 *       stream: false,
 *       format: options.format,
 *     }));
 *   }
 *
 *   protected async healthCheck(): Promise<boolean> {
 *     try {
 *       const res = await fetch(`${this.baseUrl}/api/tags`);
 *       return res.ok;
 *     } catch {
 *       return false;
 *     }
 *   }
 * }
 *
 * @see {@link ChatMessage} - Unified message shape
 * @see {@link NormalizedResponse} - Guaranteed return format
 * @see {@link LLMConfig} - Constructor config shapes
 */
export abstract class BaseLanguageModel {
  protected model: string;
  protected baseUrl: string;
  protected apiKey?: string;
  protected isInitialized = false;
  protected isHealthy = false;

  constructor(config: LLMConfig | RemoteProviderConfig) {
    if ('mode' in config) {
      // Local config (Ollama)
      this.model = config.localModel;
      this.baseUrl = config.ollamaBase.endsWith('/') 
        ? config.ollamaBase.slice(0, -1) 
        : config.ollamaBase;
    } else {
      // Remote provider config
      this.model = config.model;
      this.baseUrl = config.baseUrl.endsWith('/') 
        ? config.baseUrl.slice(0, -1) 
        : config.baseUrl;
      this.apiKey = config.apiKey;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Public API (common to all implementations)
  // ─────────────────────────────────────────────────────────────

  async initialize(): Promise<boolean> {
    this.isHealthy = await this.healthCheck();
    this.isInitialized = true;
    return this.isHealthy;
  }

  isAvailable(): boolean {
    return this.isInitialized && this.isHealthy;
  }

  getModel(): string {
    return this.model;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getProviderName(): string {
    return this.constructor.name.replace('Service', '');
  }

  /**
   * Main chat method — all services use this
   */
  async chat(
    messages: ChatMessage[],
    options: {
      model?: string;
      maxTokens?: number;
      format?: 'json' | undefined;
      temperature?: number;
      signal?: AbortSignal;
      timeoutSeconds?: number;
    } = {}
  ): Promise<NormalizedResponse | null> {
    const startTime = performance.now();

    try {
      // Use provided model or fallback to default
      const effectiveModel = options.model ?? this.model;

      const rawResponse = await this.sendRawRequest(messages, {
        ...options,
        model: effectiveModel,
      });

      if (!rawResponse) {
        return null;
      }

      const normalized = this.normalizeResponse(rawResponse);

      // Override time_spent with real wall-clock time
      normalized.metadata.time_spent = Math.round(performance.now() - startTime);
      normalized.metadata.model = effectiveModel;

      return normalized;
    } catch (error) {
      console.error(`[${this.getProviderName()}] Chat failed:`, error);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Must be implemented by subclasses
  // ─────────────────────────────────────────────────────────────

  /**
   * Subclass implements the actual HTTP call
   * (Ollama → /api/chat, OpenAI/xAI → /v1/chat/completions, etc.)
   */
  protected abstract sendRawRequest(
    messages: ChatMessage[],
    options: any
  ): Promise<any>;

  /**
   * Health check — should be overridden when needed
   */
  protected abstract healthCheck(): Promise<boolean>;

  // ─────────────────────────────────────────────────────────────
  // Shared utilities
  // ─────────────────────────────────────────────────────────────

  /**
   * Normalizes any LLM response into a consistent shape
   */
  protected normalizeResponse(raw: any): NormalizedResponse {
    let content = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    // OpenAI / xAI / Groq / Mistral / Together / Fireworks
    if (raw.choices?.[0]?.message?.content) {
      content = raw.choices[0].message.content;
      totalTokens = raw.usage?.total_tokens ?? 0;
      promptTokens = raw.usage?.prompt_tokens ?? 0;
      completionTokens = raw.usage?.completion_tokens ?? 0;
    }
    // Ollama /api/chat (non-stream)
    else if (raw.message?.content) {
      content = raw.message.content;
      promptTokens = raw.prompt_eval_count ?? 0;
      completionTokens = raw.eval_count ?? 0;
      totalTokens = promptTokens + completionTokens;
    }
    // Anthropic
    else if (raw.content?.[0]?.text) {
      content = raw.content[0].text;
      promptTokens = raw.usage?.input_tokens ?? 0;
      completionTokens = raw.usage?.output_tokens ?? 0;
      totalTokens = promptTokens + completionTokens;
    }
    // Generic fallback
    else if (typeof raw === 'string') {
      content = raw;
    } else if (raw.content) {
      content = String(raw.content);
    } else if (raw.text) {
      content = String(raw.text);
    }

    return {
      content: content.trim(),
      metadata: {
        tokens_used: totalTokens || completionTokens,
        time_spent: 0,                    // will be overridden in chat()
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
      },
    };
  }

  // Optional: helper for building fetch options (auth, timeout, etc.)
  protected buildFetchOptions(body: any, signal?: AbortSignal): RequestInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    return {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    };
  }
}




/**
 * ILLMService - Common interface for LLM services
 * Implemented by OllamaService (local) and RemoteModelService (API)
 */
export interface ILLMService {
  /**
   * Initialize the service and check availability
   */
  initialize(): Promise<boolean>;

  /**
   * Check if the service is available
   */
  isAvailable(): boolean;

  /**
   * Get the current model name
   */
  getModel(): string;

  /**
   * Chat completion with message history
   */
  chat(messages: ChatMessage[], options?: { 
    model?: string;
    maxTokens?: number;
    format?: 'json' | undefined;
    signal?: AbortSignal;
  }): Promise<string | null>;

  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;

  /**
   * Pull a model from the service (only available for local services)
   */
  pullModel?(modelName: string, onProgress?: (status: string) => void): Promise<boolean>;
}

/**
 * Provider configuration for remote APIs
 */
export interface RemoteProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

