import type { ThreadState, ToolResult } from '../types';
import { getChromaService } from '../services/ChromaService';
import { getMemoryPedia } from '../services/MemoryPedia';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

function normalizePageId(name: string): string {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export class KnowledgeBaseCreatePageTool extends BaseTool {
  override readonly name = 'knowledge_base_create_page';
  override readonly aliases = ['kb_create_page', 'knowledgebase_create_page'];
  override readonly category = 'memory';

  override getPlanningInstructions(): string {
    return [
      '6) knowledge_base_create_page (KnowledgeBase / Chroma pages)',
      '   - Purpose: Create a KnowledgeBase page (wiki-style) in Chroma collection "memorypedia_pages".',
      '   - Args:',
      '     - title (string, required)',
      '     - content (string, required)',
      '     - pageId (string, optional)  // if omitted, derived from title',
      '     - pageType (string, optional)  // e.g. "project", "concept", "api"',
      '     - relatedThreads (string[], optional)',
      '   - Output: Stores/updates the page and returns the final pageId.',
    ].join('\n');
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const chroma = getChromaService();

    const title = String(context.args?.title || '').trim();
    const content = String(context.args?.content || '').trim();
    const pageType = String(context.args?.pageType || 'user').trim();

    if (!title) {
      return { toolName: this.name, success: false, error: 'Missing args: title' };
    }
    if (!content) {
      return { toolName: this.name, success: false, error: 'Missing args: content' };
    }

    const explicitPageId = String(context.args?.pageId || '').trim();
    const pageId = explicitPageId || normalizePageId(title);
    if (!pageId) {
      return { toolName: this.name, success: false, error: 'Could not derive pageId from title; provide args.pageId' };
    }

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

      const success = await chroma.upsert(
        'memorypedia_pages',
        [pageId],
        [content],
        [{
          title,
          pageType,
          relatedThreads: relatedThreads.join(','),
          lastUpdated: Date.now(),
        }],
      );

      if (!success) {
        return { toolName: this.name, success: false, error: 'Failed to upsert KnowledgeBase page' };
      }

      (state.metadata as any).knowledgeBaseLastWrite = { op: 'create', pageId, title };

      return { toolName: this.name, success: true, result: { pageId, title } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
