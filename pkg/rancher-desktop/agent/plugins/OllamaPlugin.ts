// OllamaPlugin - Calls Ollama LLM to generate responses

import type { ThreadState } from '../types';
import { BasePlugin } from './BasePlugin';

export interface OllamaPluginSettings {
  baseUrl: string;
  model: string;
  stream: boolean;
}

export class OllamaPlugin extends BasePlugin {
  private availableModel: string | null = null;

  constructor(settings?: Partial<OllamaPluginSettings>) {
    super({
      id:       'ollama',
      name:     'Ollama LLM',
      order:    50, // Middle of the pipeline - after prompt preparation, before response processing
      settings: {
        baseUrl: settings?.baseUrl ?? 'http://127.0.0.1:30114',
        model:   settings?.model ?? '', // Empty means auto-detect
        stream:  settings?.stream ?? false,
      },
    });
  }

  get settings(): OllamaPluginSettings {
    return this.config.settings as OllamaPluginSettings;
  }

  async initialize(): Promise<void> {
    // Try to detect available model on init
    await this.detectModel();
  }

  private async detectModel(): Promise<string | null> {
    try {
      const res = await fetch(`${ this.settings.baseUrl }/api/tags`);

      if (res.ok) {
        const data = await res.json();

        if (data.models && data.models.length > 0) {
          this.availableModel = data.models[0].name;

          return this.availableModel;
        }
      }
    } catch {
      // Model detection failed
    }

    return null;
  }

  async process(state: ThreadState): Promise<ThreadState> {
    // Determine which model to use
    let model = this.settings.model;

    if (!model) {
      // Auto-detect if not specified
      if (!this.availableModel) {
        await this.detectModel();
      }
      model = this.availableModel || '';
    }

    if (!model) {
      state.metadata.error = '[ollama] No model available. Ollama may still be downloading.';

      return state;
    }

    // Build prompt from short-term memory + current input
    const lastUserMessage = state.messages[state.messages.length - 1];
    let prompt = lastUserMessage?.content || '';

    // Add context from short-term memory if available
    if (state.shortTermMemory.length > 1) {
      const context = state.shortTermMemory
        .slice(0, -1) // Exclude the current message
        .map(m => `${ m.role === 'user' ? 'User' : 'Assistant' }: ${ m.content }`)
        .join('\n');

      prompt = `Previous conversation:\n${ context }\n\nUser: ${ prompt }`;
    }

    // Apply any prompt modifications from metadata
    if (state.metadata.promptPrefix) {
      prompt = `${ state.metadata.promptPrefix }\n\n${ prompt }`;
    }

    if (state.metadata.promptSuffix) {
      prompt = `${ prompt }\n\n${ state.metadata.promptSuffix }`;
    }

    try {
      const res = await fetch(`${ this.settings.baseUrl }/api/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          model,
          prompt,
          stream: this.settings.stream,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));

        throw new Error(errData.error || `HTTP ${ res.status }: ${ res.statusText }`);
      }

      const data = await res.json();

      state.metadata.response = data.response || '';
      state.metadata.ollamaModel = model;
      state.metadata.ollamaEvalCount = data.eval_count;
      state.metadata.ollamaEvalDuration = data.eval_duration;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      state.metadata.error = `[ollama] Failed to generate response: ${ message }`;
    }

    return state;
  }
}
