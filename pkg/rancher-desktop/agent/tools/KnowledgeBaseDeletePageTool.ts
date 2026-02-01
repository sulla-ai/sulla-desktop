import type { ThreadState, ToolResult } from '../types';
import { getChromaService } from '../services/ChromaService';
import { getMemoryPedia } from '../services/MemoryPedia';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class KnowledgeBaseDeletePageTool extends BaseTool {
  override readonly name = 'knowledge_base_delete_page';
  override readonly aliases = ['kb_delete_page', 'knowledgebase_delete_page'];
  override readonly category = 'memory';

  override getPlanningInstructions(): string {
    return [
      '8) knowledge_base_delete_page (KnowledgeBase / Chroma pages)',
      '   - Purpose: Delete a KnowledgeBase page from Chroma collection "memorypedia_pages".',
      '   - Args:',
      '     - pageId (string, required)',
      '   - Output: Deletes the page by id.',
    ].join('\n');
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const chroma = getChromaService();

    const pageId = String(context.args?.pageId || '').trim();
    if (!pageId) {
      return { toolName: this.name, success: false, error: 'Missing args: pageId' };
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

      await chroma.refreshCollections();

      const success = await chroma.delete('memorypedia_pages', [pageId]);
      if (!success) {
        return { toolName: this.name, success: false, error: 'Failed to delete KnowledgeBase page' };
      }

      (state.metadata as any).knowledgeBaseLastWrite = { op: 'delete', pageId };

      return { toolName: this.name, success: true, result: { pageId } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
