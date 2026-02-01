import type { ThreadState, ToolResult } from '../types';
import { getChromaService } from '../services/ChromaService';
import { getMemoryPedia } from '../services/MemoryPedia';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class KnowledgeBaseListPagesTool extends BaseTool {
  override readonly name = 'knowledge_base_list_pages';
  override readonly aliases = ['kb_list_pages', 'knowledgebase_list_pages'];
  override readonly category = 'memory';

  override getPlanningInstructions(): string {
    return [
      '9) knowledge_base_list_pages (KnowledgeBase / Chroma pages)',
      '   - Purpose: List KnowledgeBase pages from Chroma collection "memorypedia_pages" without needing a search query.',
      '   - Args:',
      '     - limit (number, optional)          // default 50, max 500',
      '     - includeContent (boolean, optional) // default false; if true includes full documents',
      '   - Output: Returns page ids + metadata (and optionally content).',
    ].join('\n');
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const chroma = getChromaService();

    const limitRaw = context.args?.limit;
    const limit = Number.isFinite(Number(limitRaw)) ? Math.max(1, Math.min(500, Number(limitRaw))) : 50;

    const includeContent = context.args?.includeContent === true;

    try {
      try {
        await getMemoryPedia().initialize();
      } catch {
        // continue
      }

      const ok = await chroma.initialize();
      if (!ok || !chroma.isAvailable()) {
        return { toolName: this.name, success: false, error: 'Chroma not available' };
      }

      await chroma.ensureCollection('memorypedia_pages');
      await chroma.refreshCollections();

      const include = includeContent ? ['documents', 'metadatas'] : ['metadatas'];
      const data = await chroma.get('memorypedia_pages', undefined, { limit, include });

      const ids = data?.ids || [];
      const metadatas = data?.metadatas || [];
      const documents = data?.documents || [];

      const pages = ids.map((id, i) => {
        const md = metadatas[i] || {};
        const title = String((md as any).title || id);
        const pageType = String((md as any).pageType || 'entity');
        const lastUpdated = Number((md as any).lastUpdated) || null;

        if (includeContent) {
          return {
            pageId: id,
            title,
            pageType,
            lastUpdated,
            content: documents[i] || '',
          };
        }

        return { pageId: id, title, pageType, lastUpdated };
      });

      (state.metadata as any).knowledgeBaseList = pages;

      return {
        toolName: this.name,
        success: true,
        result: { count: pages.length, limit, includeContent, pages },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
