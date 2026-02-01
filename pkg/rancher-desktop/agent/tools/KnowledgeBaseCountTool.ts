import type { ThreadState, ToolResult } from '../types';
import { getChromaService } from '../services/ChromaService';
import { getMemoryPedia } from '../services/MemoryPedia';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class KnowledgeBaseCountTool extends BaseTool {
  override readonly name = 'knowledge_base_count';
  override readonly aliases = ['kb_count', 'knowledgebase_count'];
  override readonly category = 'memory';

  override getPlanningInstructions(): string {
    return [
      '4) knowledge_base_count (KnowledgeBase / Chroma pages)',
      '   - Purpose: Count how many KnowledgeBase pages exist in Chroma collection "memorypedia_pages".',
      '   - Args: none',
      '   - Output: Count only.',
    ].join('\n');
  }

  override async execute(state: ThreadState, _context: ToolContext): Promise<ToolResult> {
    const chroma = getChromaService();

    try {
      try {
        await getMemoryPedia().initialize();
      } catch {
        // continue
      }

      await chroma.initialize();
      await chroma.refreshCollections();

      const pages = await chroma.count('memorypedia_pages');
      state.metadata.knowledgeBaseCounts = { pages };

      return { toolName: this.name, success: true, result: { pages } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
