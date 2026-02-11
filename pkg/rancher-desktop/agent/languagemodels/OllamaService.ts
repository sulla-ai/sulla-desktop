import { SullaSettingsModel } from '../database/models/SullaSettingsModel';
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
  protected localTimeoutSeconds: number;

  static async create() {
    const base = 'http://127.0.0.1:30114';
    const model = await SullaSettingsModel.get('sullaModel', 'tinyllama:latest');
    const timeout = await SullaSettingsModel.get('localTimeoutSeconds', 120);

    return new OllamaService(model, base, timeout);
  }

  private constructor(localModel: string, ollamaBase: string, localTimeoutSeconds: number) {
    super({
      mode: 'local',
      localModel,
      ollamaBase,
      localTimeoutSeconds,
    });
    this.localTimeoutSeconds = localTimeoutSeconds;
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
   * Core request to Ollama /api/chat (non-streaming).
   * @override
   */
  protected async sendRawRequest(messages: ChatMessage[], options: any): Promise<any> {
    const body: Record<string, any> = {
      model: options.model ?? this.model,
      messages,
      stream: false,
      keep_alive: -1,
    };

    if (options.format === 'json') {
      body.format = 'json';
    }

    if (options.maxTokens) {
      body.options = { ...(body.options ?? {}), num_predict: options.maxTokens };
    }

    // Force GPU usage for all layers if possible
    body.options = { ...(body.options ?? {}), num_gpu: 999, num_thread: 1 };

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

  /**
   * Pull a model from Ollama
   */
  public async pullModel(modelName: string, onProgress?: (status: string) => void): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) {
        console.error(`[OllamaService] Pull failed: ${response.status} ${response.statusText}`);
        return false;
      }

      // Ollama pull returns a stream of JSON lines with status updates
      const reader = response.body?.getReader();
      if (!reader) {
        console.error('[OllamaService] No response body for pull');
        return false;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            const status = data.status || data.message || 'unknown';
            onProgress?.(status);

            // Check if pull completed
            if (status.includes('complete') || status.includes('success') || data.status === 'complete') {
              await this.preloadModel(modelName);
              return true;
            }
          } catch (e) {
            console.warn('[OllamaService] Failed to parse pull status:', line, e);
          }
        }
      }

      // If we reach here, assume success if no error
      return true;
    } catch (error) {
      console.error('[OllamaService] Error pulling model:', error);
      return false;
    }
  }

  /**
   * Preloads the specified model by making a dummy generate request with keep_alive.
   * This keeps the model loaded in memory for faster subsequent responses.
   */
  private async preloadModel(modelName: string): Promise<void> {
    try {
      console.log(`[OllamaService] Preloading model: ${modelName}`);
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          prompt: 'Hello',
          keep_alive: -1,
          stream: false,
        }),
      });

      if (response.ok) {
        console.log(`[OllamaService] Model ${modelName} preloaded successfully`);
      } else {
        console.warn(`[OllamaService] Failed to preload model ${modelName}: ${response.status}`);
      }
    } catch (error) {
      console.warn(`[OllamaService] Error preloading model ${modelName}:`, error);
    }
  }
}

// Singleton export (optional — you can also just `await OllamaService.create()`)
let ollamaInstance: OllamaService | null = null;

export async function getOllamaService(): Promise<OllamaService> {
  if (!ollamaInstance) {
    ollamaInstance = await OllamaService.create();
  }
  return ollamaInstance;
}