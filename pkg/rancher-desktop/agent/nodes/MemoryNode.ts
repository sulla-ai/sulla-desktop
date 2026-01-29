// MemoryNode - Uses LLM to determine what to search for, then queries Chroma

import type { ThreadState, NodeResult } from '../types';
import { BaseNode } from './BaseNode';

const CHROMA_BASE = 'http://127.0.0.1:30115';

interface SearchPlan {
  searchQuery: string;
  collection: string;
  whereClause?: Record<string, unknown>;
  reasoning: string;
}

export class MemoryNode extends BaseNode {
  private availableCollections: string[] = [];

  constructor() {
    super('memory_recall', 'Memory Recall');
  }

  async initialize(): Promise<void> {
    await super.initialize(); // Initialize LLM from BaseNode
    await this.refreshCollections();
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    // Get the latest user message
    const lastUserMessage = state.messages.filter(m => m.role === 'user').pop();

    if (!lastUserMessage) {
      return { state, next: 'continue' };
    }

    try {
      // Refresh collections list
      await this.refreshCollections();

      if (this.availableCollections.length === 0) {
        // No collections available, skip memory retrieval
        return { state, next: 'continue' };
      }

      // Use LLM to determine what to search for and where
      const searchPlan = await this.planSearch(lastUserMessage.content, state);

      if (!searchPlan) {
        return { state, next: 'continue' };
      }

      // Store the search plan in metadata for debugging
      state.metadata.memorySearchPlan = searchPlan;

      // Query Chroma with the planned search
      const memories = await this.queryChroma(searchPlan);

      if (memories.length > 0) {
        state.metadata.retrievedMemories = memories;
        state.metadata.memoryContext = memories
          .map((m, i) => `[Memory ${ i + 1 }]: ${ m }`)
          .join('\n');
      }
    } catch (err) {
      console.warn('Memory retrieval failed:', err);
    }

    return { state, next: 'continue' };
  }

  /**
   * Refresh the list of available Chroma collections
   */
  private async refreshCollections(): Promise<void> {
    try {
      const res = await fetch(`${ CHROMA_BASE }/api/v1/collections`, {
        signal: AbortSignal.timeout(2000),
      });

      if (res.ok) {
        const collections = await res.json();

        this.availableCollections = collections.map((c: { name: string }) => c.name);
      }
    } catch {
      // Keep existing collections list
    }
  }

  /**
   * Use LLM to determine what to search for and which collection to query
   */
  private async planSearch(userQuery: string, state: ThreadState): Promise<SearchPlan | null> {
    // Build context about available collections
    const collectionsInfo = this.availableCollections.length > 0
      ? `Available collections: ${ this.availableCollections.join(', ') }`
      : 'No collections available';

    const prompt = `You are a memory retrieval planner. Given a user query, determine what to search for in the vector database.

${ collectionsInfo }

Current user query: "${ userQuery }"

Respond in JSON format only:
{
  "searchQuery": "the semantic search query to find relevant memories",
  "collection": "which collection to search (use one from available, or 'conversations' as default)",
  "whereClause": { "optional": "metadata filters" },
  "reasoning": "brief explanation of search strategy"
}

If no memory search is needed (simple greeting, etc), respond with:
{ "skip": true, "reasoning": "why no search needed" }`;

    // Use BaseNode's promptJSON helper
    const parsed = await this.promptJSON<{
      skip?: boolean;
      searchQuery?: string;
      collection?: string;
      whereClause?: Record<string, unknown>;
      reasoning?: string;
    }>(prompt, { timeout: 10000 });

    if (!parsed) {
      return this.fallbackSearchPlan(userQuery);
    }

    if (parsed.skip) {
      return null;
    }

    // Validate collection exists
    let collection = parsed.collection || 'conversations';

    if (!this.availableCollections.includes(collection)) {
      collection = this.availableCollections[0] || 'conversations';
    }

    return {
      searchQuery:  parsed.searchQuery || userQuery,
      collection,
      whereClause:  parsed.whereClause,
      reasoning:    parsed.reasoning || 'LLM planned search',
    };
  }

  /**
   * Fallback search plan when LLM is unavailable
   */
  private fallbackSearchPlan(userQuery: string): SearchPlan {
    return {
      searchQuery: userQuery,
      collection:  this.availableCollections[0] || 'conversations',
      reasoning:   'Fallback: direct query search',
    };
  }

  /**
   * Query Chroma with the search plan
   */
  private async queryChroma(plan: SearchPlan, limit = 5): Promise<string[]> {
    try {
      // Build query body
      const queryBody: Record<string, unknown> = {
        query_texts: [plan.searchQuery],
        n_results:   limit,
      };

      // Add where clause if provided
      if (plan.whereClause && Object.keys(plan.whereClause).length > 0) {
        queryBody.where = plan.whereClause;
      }

      const res = await fetch(`${ CHROMA_BASE }/api/v1/collections/${ plan.collection }/query`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(queryBody),
        signal:  AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        return [];
      }

      const data = await res.json();

      return data.documents?.[0] || [];
    } catch {
      return [];
    }
  }
}
