// KnowledgeWriterNode.ts - top imports (minimal & exact)

import type { KnowledgeThreadState, NodeResult } from './Graph';
import { BaseNode } from './BaseNode';
import { Article } from '../database/models/Article';

/**
 * Knowledge Writer Node
 *
 * Purpose:
 *   - Terminal node: persists final KB article draft to Chroma
 *   - Upserts document + metadata into knowledgebase_articles collection
 *   - Uses slug as document ID
 *   - Sets kbStatus = 'published' on success
 *
 * Key Design Decisions (2025 refactor):
 *   - Removed AgentLog / console.log / error tracking bloat
 *   - Direct Chroma upsert via getChromaService()
 *   - Clean metadata normalization (no NaN/undefined)
 *   - Neutral decision — always 'end'
 *   - WS feedback only on success
 *   - Uses KnowledgeThreadState shape
 *
 * Input expectations:
 *   - state.metadata.kbFinalContent ← JSON string from executor
 *   - state.metadata.kbArticleSchema ← {slug, title, ...}
 *   - Chroma service available
 *
 * Output mutations:
 *   - Chroma: upsert document in knowledgebase_articles
 *   - state.metadata.kbStatus = 'published' on success
 *   - state.metadata.kbArticleId ← Chroma document ID (slug)
 *
 * @extends BaseNode
 */
export class KnowledgeWriterNode extends BaseNode {
  constructor() {
    super('knowledge_writer', 'Knowledge Writer');
  }

  async execute(state: KnowledgeThreadState): Promise<NodeResult<KnowledgeThreadState>> {

    // Establish WebSocket connection using the dynamic channel from state
    const connectionId = state.metadata.wsChannel as string;
    if (connectionId && !this.isWebSocketConnected(connectionId)) {
      this.connectWebSocket(connectionId);
    }

    const page = state.metadata.kbFinalContent;
    const schema = state.metadata.kbArticleSchema;
    if (!page?.trim()) {
      return { state, decision: { type: 'end' } };
    }

    const slug = String(schema.slug || '').trim();

    const attributes: Record<string, unknown> = {
      schemaversion: 1,
      section: String(schema.section || '').trim(),
      category: String(schema.category || '').trim(),
      slug,
      title: String(schema.title || slug).trim(),
      tags: Array.isArray(schema.tags) ? schema.tags.join(',') : '',
      order: Number.isFinite(Number(schema.order)) ? Number(schema.order) : 10,
      locked: 0,
      author: String(schema.author || 'Sulla').trim(),
      document: page
    };

    try {
      const article = await Article.create(attributes);

      state.metadata.kbStatus = 'published';
      state.metadata.kbArticleId = slug;


      return { state, decision: { type: 'end' } };
    } catch {
      return { state, decision: { type: 'end' } };
    }
  }
}