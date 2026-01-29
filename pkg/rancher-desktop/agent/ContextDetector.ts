// ContextDetector - Fast heuristic/LLM for thread selection
// Prefrontal analog: classifies topic, matches to existing thread or creates new

import type { SensoryInput, ThreadContext } from './types';

const OLLAMA_BASE = 'http://127.0.0.1:30114';

export class ContextDetector {
  private threadSummaries: Map<string, string> = new Map();

  /**
   * Detect context from sensory input
   * Returns thread ID (existing or new) + summary
   */
  async detect(input: SensoryInput): Promise<ThreadContext> {
    const text = input.data;

    // If no existing threads, create new
    if (this.threadSummaries.size === 0) {
      return this.createNewThread(text);
    }

    // Fast heuristic: try to match existing thread
    const match = await this.findMatchingThread(text);

    if (match) {
      return match;
    }

    // No match found, create new thread
    return this.createNewThread(text);
  }

  /**
   * Find matching thread using simple heuristic
   * In production, this would use embedding similarity
   */
  private async findMatchingThread(text: string): Promise<ThreadContext | null> {
    // Simple keyword matching for now
    // TODO: Replace with embedding similarity via Chroma
    const textLower = text.toLowerCase();

    for (const [threadId, summary] of this.threadSummaries) {
      const summaryLower = summary.toLowerCase();
      const words = textLower.split(/\s+/).filter(w => w.length > 3);
      const matchCount = words.filter(w => summaryLower.includes(w)).length;

      if (matchCount >= 2 || (words.length <= 3 && matchCount >= 1)) {
        return {
          threadId,
          isNew:      false,
          summary,
          confidence: Math.min(matchCount / words.length, 1),
        };
      }
    }

    return null;
  }

  /**
   * Create a new thread context
   */
  private async createNewThread(text: string): Promise<ThreadContext> {
    const threadId = `thread_${ Date.now() }`;
    const summary = await this.generateSummary(text);

    this.threadSummaries.set(threadId, summary);

    return {
      threadId,
      isNew:      true,
      summary,
      confidence: 1.0,
    };
  }

  /**
   * Generate a brief summary of the input
   * Uses LLM for better summaries, falls back to truncation
   */
  private async generateSummary(text: string): Promise<string> {
    try {
      const res = await fetch(`${ OLLAMA_BASE }/api/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          model:  'tinyllama',
          prompt: `Summarize this in 5 words or less: "${ text.substring(0, 200) }"`,
          stream: false,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = await res.json();

        return data.response?.trim() || text.substring(0, 50);
      }
    } catch {
      // Fall back to simple truncation
    }

    return text.substring(0, 50) + (text.length > 50 ? '...' : '');
  }

  /**
   * Register an existing thread summary (for persistence)
   */
  registerThread(threadId: string, summary: string): void {
    this.threadSummaries.set(threadId, summary);
  }

  /**
   * Get all known thread IDs
   */
  getThreadIds(): string[] {
    return Array.from(this.threadSummaries.keys());
  }

  /**
   * Clear all thread summaries
   */
  clear(): void {
    this.threadSummaries.clear();
  }
}

// Singleton instance
let detectorInstance: ContextDetector | null = null;

export function getContextDetector(): ContextDetector {
  if (!detectorInstance) {
    detectorInstance = new ContextDetector();
  }

  return detectorInstance;
}
