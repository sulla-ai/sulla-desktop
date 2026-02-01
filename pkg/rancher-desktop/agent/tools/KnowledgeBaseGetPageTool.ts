import type { ThreadState, ToolResult } from '../types';
import { getChromaService } from '../services/ChromaService';
import { getMemoryPedia } from '../services/MemoryPedia';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

function normalizePageId(name: string): string {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export class KnowledgeBaseGetPageTool extends BaseTool {
  override readonly name = 'knowledge_base_get_page';
  override readonly aliases = ['kb_get_page', 'knowledgebase_get_page'];
  override readonly category = 'memory';

  override getPlanningInstructions(): string {
    return [
      '10) knowledge_base_get_page (KnowledgeBase / Chroma pages)',
      '   - Purpose: Get the contents of a specific KnowledgeBase page from Chroma collection "memorypedia_pages".',
      '   - Args:',
      '     - pageId (string, optional) // preferred',
      '     - title (string, optional)  // used to derive pageId if pageId omitted',
      '   - Output: Returns the page (id + metadata + content) if it exists.',
    ].join('\n');
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const chroma = getChromaService();

    const pageIdRaw = String(context.args?.pageId || '').trim();
    const title = String(context.args?.title || '').trim();
    const pageId = pageIdRaw || (title ? normalizePageId(title) : '');

    if (!pageId) {
      return { toolName: this.name, success: false, error: 'Missing args: pageId (or provide title to derive it)' };
    }

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

      const data = await chroma.get('memorypedia_pages', [pageId], { include: ['documents', 'metadatas'] });

      const ids = data?.ids || [];
      if (!ids.length) {
        return { toolName: this.name, success: false, error: `KnowledgeBase page not found: ${pageId}` };
      }

      const md = (data?.metadatas && data.metadatas[0]) || {};
      const content = (data?.documents && data.documents[0]) || '';

      const result = {
        pageId,
        title: String((md as any).title || pageId),
        pageType: String((md as any).pageType || 'entity'),
        lastUpdated: Number((md as any).lastUpdated) || null,
        metadata: md,
        content,
      };

      (state.metadata as any).knowledgeBasePage = result;

      return { toolName: this.name, success: true, result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
