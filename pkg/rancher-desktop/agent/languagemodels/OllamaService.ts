import { getOllamaBase, getOllamaModel, getLocalConfig } from '../services/ConfigService';
import { BaseLanguageModel, type ChatMessage, type NormalizedResponse } from './BaseLanguageModel';

/**
 * Ollama local LLM provider.
 *
 * Extends BaseLanguageModel to provide unified interface for local Ollama instances.
 * Handles model discovery, pulling, chat completions (with/without format), timeouts,
 * and normalized responses with token usage and timing.
 *
 * @extends BaseLanguageModel
 */
export class OllamaService extends BaseLanguageModel {
  private availableModels: string[] = [];

  constructor() {
    const base = getOllamaBase();
    const model = getOllamaModel();

    super({
      mode: 'local',
      localModel: model,
      ollamaBase: base,
      localTimeoutSeconds: getLocalConfig().timeoutSeconds ?? 60,
    });
  }

  /**
   * Initialize Ollama connection and discover available models.
   * @returns Whether Ollama is reachable and has models
   */
  protected async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) return false;

      const data = await res.json();
      this.availableModels = (data.models ?? []).map((m: any) => m.name);
      return this.availableModels.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * List of currently known models on this Ollama instance.
   */
  public getAvailableModels(): string[] {
    return [...this.availableModels];
  }

  /**
   * Check whether a specific model exists locally.
   */
  public hasModel(modelName: string): boolean {
    return this.availableModels.includes(modelName);
  }

  /**
   * Refresh model list from /api/tags.
   * @returns Updated model list
   */
  public async refreshModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        this.availableModels = (data.models ?? []).map((m: any) => m.name);
      }
    } catch {
      // keep existing list
    }
    return this.availableModels;
  }

  /**
   * Pull a model from library if not present.
   * @param modelName e.g. "llama3.2:3b", "qwen2.5:7b"
   * @param onProgress Optional progress callback
   * @returns Success
   */
  public async pullModel(modelName: string, onProgress?: (status: string) => void): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: false }),
        signal: AbortSignal.timeout(600_000), // 10 min
      });

      if (res.ok) {
        await this.refreshModels();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Core request to Ollama /api/chat (non-streaming).
   * @override
   */
  protected async sendRawRequest(messages: ChatMessage[], options: any): Promise<any> {
    const { timeoutSeconds } = getLocalConfig();

    const body: Record<string, any> = {
      model: options.model ?? this.model,
      messages,
      stream: false,
    };

    if (options.format === 'json') {
      body.format = 'json';
    }

    if (options.maxTokens) {
      body.options = { ...(body.options ?? {}), num_predict: options.maxTokens };
    }

    const res = await fetch(`${this.baseUrl}/api/chat`, this.buildFetchOptions(body, options.signal));

    if (!res.ok) {
      throw new Error(`Ollama chat failed: ${res.status} ${res.statusText}`);
    }

    return res.json();
  }

  /**
   * Normalize Ollama /api/chat response shape.
   * @override
   */
  protected normalizeResponse(raw: any): NormalizedResponse {
    let content = raw?.message?.content ?? '';
    let promptTokens = raw?.prompt_eval_count ?? 0;
    let completionTokens = raw?.eval_count ?? 0;

    const durationNs = raw?.total_duration ?? raw?.eval_duration ?? 0;
    const timeMs = Math.round(durationNs / 1_000_000);

    return {
      content: content.trim(),
      metadata: {
        tokens_used: promptTokens + completionTokens,
        time_spent: timeMs,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        model: raw?.model,
      },
    };
  }

  /**
   * Legacy convenience method — prefer .chat()
   */
  public async generate(prompt: string, options?: { signal?: AbortSignal }): Promise<NormalizedResponse | null> {
    return this.chat([{ role: 'user', content: prompt }], options);
  }
}

// Singleton export (optional — you can also just `new OllamaService()`)
let ollamaInstance: OllamaService | null = null;

export function getOllamaService(): OllamaService {
  if (!ollamaInstance) {
    ollamaInstance = new OllamaService();
  }
  return ollamaInstance;
}