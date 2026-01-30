// ContextDetector - Fast heuristic/LLM for thread selection
// Prefrontal analog: classifies topic, matches to existing thread or creates new
// Integrates with MemoryPedia for semantic search of past conversations

import type { SensoryInput, ThreadContext } from './types';
import { getMemoryPedia } from './services/MemoryPedia';
import { getLLMService } from './services/LLMServiceFactory';
import { getAwarenessService } from './services/AwarenessService';
import { getPlanService } from './services/PlanService';

// Minimum similarity score to consider a thread match (0-1, lower = more similar in Chroma)
const SIMILARITY_THRESHOLD = 0.7;

// How much better a new semantic match must be (vs current thread match) to justify switching
const SWITCH_MARGIN = 0.15;

export class ContextDetector {
  private threadSummaries: Map<string, string> = new Map();
  private initialized = false;

  /**
   * Initialize by loading existing thread summaries from MemoryPedia
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[ContextDetector] Initializing...');

    // Load existing summaries from MemoryPedia/Chroma
    try {
      const memoryPedia = getMemoryPedia();

      await memoryPedia.initialize();

      // Search for all summaries (empty query returns recent)
      const summaries = await memoryPedia.searchSummaries('', 100);

      for (const s of summaries) {
        this.threadSummaries.set(s.threadId, s.summary);
      }

      console.log(`[ContextDetector] Loaded ${summaries.length} thread summaries from MemoryPedia`);
    } catch (err) {
      console.warn('[ContextDetector] Failed to load summaries:', err);
    }

    this.initialized = true;
  }

  /**
   * Detect context from sensory input
   * Returns thread ID (existing or new) + summary
   */
  async detect(input: SensoryInput, currentThreadId?: string): Promise<ThreadContext> {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }

    const text = input.data;

    try {
      const awareness = getAwarenessService();
      await awareness.initialize();
      const activePlanIds = awareness.getData().active_plan_ids || [];
      const activePlanId = activePlanIds[0] && Number.isFinite(Number(activePlanIds[0])) ? Number(activePlanIds[0]) : null;

      if (activePlanId) {
        const planService = getPlanService();
        await planService.initialize();
        const loaded = await planService.getPlan(activePlanId);

        if (loaded?.plan?.status === 'active' && loaded.plan.threadId) {
          const pinnedThreadId = loaded.plan.threadId;
          const pinnedSummary = this.threadSummaries.get(pinnedThreadId) || '';
          return {
            threadId: pinnedThreadId,
            isNew: false,
            summary: pinnedSummary,
            confidence: 1.0,
          };
        }
      }
    } catch {
      // If plan pinning fails, fall back to normal detection.
    }

    const currentSummary = currentThreadId ? this.threadSummaries.get(currentThreadId) : undefined;
    const currentConfidence = currentSummary ? this.keywordConfidence(text, currentSummary) : 0;

    // Try semantic search via MemoryPedia first
    const semanticMatch = await this.findSemanticMatch(text);

    if (currentThreadId) {
      if (semanticMatch && semanticMatch.threadId !== currentThreadId) {
        const isTopicShift = currentConfidence < 0.2;
        const shouldSwitch = isTopicShift && (semanticMatch.confidence >= SIMILARITY_THRESHOLD)
          && (semanticMatch.confidence >= currentConfidence + SWITCH_MARGIN);

        if (shouldSwitch) {
          console.log(
            `[ContextDetector] Switching threads: current=${currentThreadId} (conf=${currentConfidence.toFixed(2)}), matched=${semanticMatch.threadId} (conf=${semanticMatch.confidence.toFixed(2)})`,
          );

          return semanticMatch;
        }
      }

      // Keep current thread unless we have a strong reason to switch or start new.
      const isStrongTopicShift = currentConfidence < 0.1;
      const hasGoodOtherMatch = Boolean(semanticMatch && semanticMatch.confidence >= SIMILARITY_THRESHOLD);

      if (isStrongTopicShift && !hasGoodOtherMatch) {
        console.log('[ContextDetector] Strong topic shift detected and no good match found; creating new thread');

        return this.createNewThread(text);
      }

      return {
        threadId:   currentThreadId,
        isNew:      false,
        summary:    currentSummary || '',
        confidence: Math.max(currentConfidence, 0.5),
      };
    }

    if (semanticMatch) {
      console.log(`[ContextDetector] Semantic match found: ${semanticMatch.threadId} (score: ${semanticMatch.confidence.toFixed(2)})`);

      return semanticMatch;
    }

    // Fallback to local keyword matching
    if (this.threadSummaries.size > 0) {
      const keywordMatch = await this.findKeywordMatch(text);

      if (keywordMatch) {
        console.log(`[ContextDetector] Keyword match found: ${keywordMatch.threadId}`);

        return keywordMatch;
      }
    }

    // No match found, create new thread
    console.log('[ContextDetector] No match, creating new thread');

    return this.createNewThread(text);
  }

  private keywordConfidence(text: string, summary: string): number {
    const textLower = text.toLowerCase();
    const summaryLower = summary.toLowerCase();
    const words = textLower.split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length > 3);

    if (words.length === 0) {
      return 0;
    }

    const matchCount = words.filter(w => summaryLower.includes(w)).length;

    return Math.min(matchCount / Math.max(words.length, 1), 1);
  }

  /**
   * Find matching thread using semantic search via MemoryPedia/Chroma
   */
  private async findSemanticMatch(text: string): Promise<ThreadContext | null> {
    try {
      const memoryPedia = getMemoryPedia();

      // Search conversation summaries
      const summaries = await memoryPedia.searchSummaries(text, 3);

      if (summaries.length > 0) {
        const best = summaries[0];
        // Chroma returns distance (lower = more similar), convert to confidence
        const confidence = 1 - Math.min(best.score, 1);

        if (confidence >= SIMILARITY_THRESHOLD) {
          // Update local cache
          this.threadSummaries.set(best.threadId, best.summary);

          return {
            threadId:   best.threadId,
            isNew:      false,
            summary:    best.summary,
            confidence,
          };
        }
      }

      // Also search MemoryPedia pages for context
      const pages = await memoryPedia.searchPages(text, 3);

      if (pages.length > 0) {
        // Get related threads from the best matching page
        const page = await memoryPedia.getPageById(pages[0].pageId);

        if (page && page.relatedThreads.length > 0) {
          const relatedThreadId = page.relatedThreads[page.relatedThreads.length - 1]; // Most recent
          const relatedSummary = this.threadSummaries.get(relatedThreadId);

          if (relatedSummary) {
            return {
              threadId:   relatedThreadId,
              isNew:      false,
              summary:    relatedSummary,
              confidence: 0.6, // Lower confidence for page-based match
            };
          }
        }
      }
    } catch (err) {
      console.warn('[ContextDetector] Semantic search failed:', err);
    }

    return null;
  }

  /**
   * Find matching thread using keyword heuristic (fallback)
   */
  private async findKeywordMatch(text: string): Promise<ThreadContext | null> {
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
      const llm = getLLMService();
      const response = await llm.generate(
        `Summarize this in 5 words or less: "${ text.substring(0, 200) }"`,
      );

      if (response) {
        return response.trim() || text.substring(0, 50);
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
