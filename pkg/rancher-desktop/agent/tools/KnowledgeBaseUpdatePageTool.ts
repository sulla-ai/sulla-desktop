import type { ThreadState, ToolResult } from '../types';
import { getChromaService } from '../services/ChromaService';
import { getMemoryPedia } from '../services/MemoryPedia';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

function normalizePageId(name: string): string {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export class KnowledgeBaseUpdatePageTool extends BaseTool {
  override readonly name = 'knowledge_base_update_page';
  override readonly aliases = ['kb_update_page', 'knowledgebase_update_page', 'knowledge_base_edit_page', 'kb_edit_page'];
  override readonly category = 'memory';

  override getPlanningInstructions(): string {
    return [
      '7) knowledge_base_update_page (KnowledgeBase / Chroma pages)',
      '   - Purpose: Update (edit) an existing KnowledgeBase page in Chroma collection "memorypedia_pages".',
      '   - Args:',
      '     - pageId (string, optional)  // if omitted, derived from title',
      '     - title (string, optional)   // used for metadata + deriving pageId if needed',
      '     - content (string, required)',
      '     - pageType (string, optional)',
      '     - relatedThreads (string[], optional)',
      '   - Output: Upserts the page and returns the final pageId.',
    ].join('\n');
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const chroma = getChromaService();

    const content = String(context.args?.content || '').trim();
    if (!content) {
      return { toolName: this.name, success: false, error: 'Missing args: content' };
    }

    const title = String(context.args?.title || '').trim();
    const explicitPageId = String(context.args?.pageId || '').trim();
    const pageId = explicitPageId || (title ? normalizePageId(title) : '');

    if (!pageId) {
      return { toolName: this.name, success: false, error: 'Missing args: pageId (or provide title to derive it)' };
    }

    const pageType = String(context.args?.pageType || 'user').trim();

    const relatedThreads = Array.isArray(context.args?.relatedThreads)
      ? (context.args?.relatedThreads as unknown[]).map(String).map(s => s.trim()).filter(Boolean)
      : [];

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

      const metadata: Record<string, unknown> = {
        pageType,
        relatedThreads: relatedThreads.join(','),
        lastUpdated: Date.now(),
      };
      if (title) {
        metadata.title = title;
      }

      const success = await chroma.upsert('memorypedia_pages', [pageId], [content], [metadata]);

      if (!success) {
        return { toolName: this.name, success: false, error: 'Failed to upsert KnowledgeBase page' };
      }

      (state.metadata as any).knowledgeBaseLastWrite = { op: 'update', pageId, title: title || null };

      return { toolName: this.name, success: true, result: { pageId, title: title || null } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
