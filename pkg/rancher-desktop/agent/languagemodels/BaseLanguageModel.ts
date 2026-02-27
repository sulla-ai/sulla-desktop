// ILLMService - Common interface for all LLM services (local and remote)
// This allows the agent to use either Ollama or remote APIs interchangeably

import { tools } from "@langchain/openai";

export enum FinishReason {
  Stop = 'stop',
  ToolCalls = 'tool_calls',
  Length = 'length',
  ContentFilter = 'content_filter',
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  timestamp?: number;
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
    tool_calls?: Array<{ id?: string; name: string; args: any }>;
    finish_reason?: FinishReason;
    reasoning?: string;
    parsed_content?: any;
    rawProviderContent?: any;
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
  protected config: LLMConfig | RemoteProviderConfig;
  protected model: string;
  protected baseUrl: string;
  protected apiKey?: string;
  protected isInitialized = false;
  protected isHealthy = false;

  constructor(config: LLMConfig | RemoteProviderConfig) {
    this.config = config;
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
   * Pull a model from the service (only available for local services like Ollama)
   */
  pullModel(modelName: string, onProgress?: (status: string) => void): Promise<boolean> {
    return Promise.resolve(false);
  }
  async chat(
    messages: ChatMessage[],
    options: {
      model?: string;
      maxTokens?: number;
      format?: 'json' | undefined;
      temperature?: number;
      signal?: AbortSignal;
      timeoutSeconds?: number;
      tools?: any;
      conversationId?: string;
      nodeName?: string;
    } = {}
  ): Promise<NormalizedResponse | null> {
    const startTime = performance.now();

    try {
      // Use provided model or fallback to default
      const effectiveModel = options.model ?? this.model;

      const rawResponse = await this.sendRawRequest(messages, {
        ...options,
        model: effectiveModel,
        tools: options.tools,
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
   * Safely convert raw finish reason string to FinishReason enum
   */
  protected normalizeFinishReason(rawReason: string | undefined): FinishReason | undefined {
    if (!rawReason) return undefined;

    // Provider aliases (Anthropic/OpenAI-compatible variants)
    const normalizedAliases: Record<string, FinishReason> = {
      end_turn: FinishReason.Stop,
      max_tokens: FinishReason.Length,
      tool_use: FinishReason.ToolCalls,
    };

    if (normalizedAliases[rawReason]) {
      return normalizedAliases[rawReason];
    }
    
    // Check if the raw reason matches any enum value
    for (const reason of Object.values(FinishReason)) {
      if (reason === rawReason) {
        return reason as FinishReason;
      }
    }
    
    // If no match, return undefined or log a warning
    console.warn(`Unknown finish reason: ${rawReason}`);
    return undefined;
  }

  /**
   * Safely parse JSON content from LLM responses
   * Returns parsed object if valid JSON, null otherwise
   */
  protected parseJson<T = any>(raw: string | null | undefined): T | null {
    // If it's already an object, return it as-is
    if (typeof raw === 'object' && raw !== null) {
      return raw as T;
    }
    if (!raw || typeof raw !== 'string') return null;

    try {
      const parsed = JSON.parse(raw);
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Normalize response across providers.
   * @override
   */
  protected normalizeResponse(raw: any): NormalizedResponse {
    let content = '';
    let reasoning = '';
    let toolCalls: Array<{ id?: string; name: string; args: any }> = [];
    let finishReason: string | undefined;
    let usage = raw.usage ?? {};

    // ─────────────────────────────────────────────────────────────
    // 1. Extract finish_reason (varies by provider)
    // ─────────────────────────────────────────────────────────────
    if ('id' in this.config && this.config.id === 'anthropic') {
      finishReason = raw.stop_reason;
    } else if ('id' in this.config && this.config.id === 'google') {
      finishReason = raw.candidates?.[0]?.finishReason;
    } else {
      // OpenAI / Grok / most compatible
      finishReason = raw.choices?.[0]?.finish_reason;
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Extract content + reasoning (many models bury this)
    // ─────────────────────────────────────────────────────────────
    if ('id' in this.config && this.config.id === 'anthropic') {
      // Claude can return array of content blocks
      const blocks = raw.content || [];
      content = blocks
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n');

      reasoning = blocks
        .filter((b: any) => b.type === 'thinking' || b.type === 'reasoning')
        .map((b: any) => b.text)
        .join('\n');

    } else if ('id' in this.config && this.config.id === 'google') {
      content = raw.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    } else {
      // Grok / OpenAI style
      content = raw.choices?.[0]?.message?.content?.message ?? raw.choices?.[0]?.message?.content ?? '';

      // Some models (o1, Grok thinking, Claude) put reasoning in a separate field
      reasoning = raw.choices?.[0]?.message?.content?.reasoning 
              || raw.choices?.[0]?.message?.reasoning 
              || raw.reasoning 
              || '';
    }

    // ─────────────────────────────────────────────────────────────
    // 2.5. Attempt to parse content as JSON for structured data
    // ─────────────────────────────────────────────────────────────
    const parsedContent = this.parseJson(content);
    
    // If content was JSON with structured fields, extract them
    if (parsedContent && typeof parsedContent === 'object') {
      // Extract reasoning if present and not already set
      if (parsedContent.reasoning && typeof parsedContent.reasoning === 'string' && !reasoning) {
        reasoning = parsedContent.reasoning;
      }
      
      // Extract tool_calls if present (merge with existing)
      if (parsedContent.tool_calls && Array.isArray(parsedContent.tool_calls)) {
        const extractedToolCalls = parsedContent.tool_calls.map((tc: any) => ({
          id: tc.id,
          name: tc.function?.name || tc.name,
          args: tc.function?.arguments ? (() => {
            try {
              return typeof tc.function.arguments === 'string' 
                ? JSON.parse(tc.function.arguments) 
                : tc.function.arguments;
            } catch {
              return tc.function.arguments || {};
            }
          })() : tc.args || {},
        }));
        toolCalls.push(...extractedToolCalls);
      }
      
      // Set content to the main message/response field or stringify remaining object
      const { reasoning: _, tool_calls: __, content: mainContent, message, answer, response, ...remaining } = parsedContent;
      if (mainContent && typeof mainContent === 'string') {
        content = mainContent;
      } else if (message && typeof message === 'string') {
        content = message;
      } else if (answer && typeof answer === 'string') {
        content = answer;
      } else if (response && typeof response === 'string') {
        content = response;
      } else if (Object.keys(remaining).length > 0) {
        // If there are other fields, stringify them as content
        content = JSON.stringify(remaining);
      } else {
        // Fallback to original content if nothing else
        content = JSON.stringify(parsedContent);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Extract tool_calls (most fragile part)
    // ─────────────────────────────────────────────────────────────
    if ('id' in this.config && this.config.id === 'anthropic') {
      if (raw.content?.some((b: any) => b.type === 'tool_use')) {
        toolCalls = raw.content
          .filter((b: any) => b.type === 'tool_use')
          .map((b: any) => ({
            id: b.id,
            name: b.name,
            args: b.input || {},
          }));
      }
    } else {
      // OpenAI / Grok / most providers
      const message = raw.choices?.[0]?.message;
      const toolCallsArray = message?.tool_calls || message?.content?.tool_calls;
      if (toolCallsArray) {
        toolCalls = toolCallsArray.map((tc: any) => ({
          id: tc.id,
          name: tc.function?.name,
          args: (() => {
            try {
              return JSON.parse(tc.function?.arguments || '{}');
            } catch {
              return tc.function?.arguments || {};
            }
          })()
        }));
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Final normalized shape
    // ─────────────────────────────────────────────────────────────
    return {
      content: content.trim(),
      metadata: {
        tokens_used: (usage.total_tokens ?? usage.output_tokens ?? 0) + 
                    (usage.prompt_tokens ?? usage.input_tokens ?? 0),
        time_spent: 0,
        prompt_tokens: usage.prompt_tokens ?? usage.input_tokens ?? 0,
        completion_tokens: usage.completion_tokens ?? usage.output_tokens ?? 0,
        model: this.model,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        finish_reason: this.normalizeFinishReason(finishReason),
        reasoning: reasoning.trim() || undefined,   // ← extra safety net
        parsed_content: parsedContent,
        rawProviderContent: ('id' in this.config && this.config.id === 'anthropic' && Array.isArray(raw.content) && raw.content.length > 0)
          ? raw.content
          : undefined,
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

