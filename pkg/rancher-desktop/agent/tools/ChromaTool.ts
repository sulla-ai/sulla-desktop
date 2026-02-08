import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { articlesRegistry } from '../database/registry/ArticlesRegistry';

export class ChromaTool extends BaseTool {
  override readonly name = 'chroma';
  override readonly aliases = ['knowledgebase', 'memory', 'storage'];

  override getPlanningInstructions(): string {
    return `["chroma", "search", "query"] - Knowledgebase articles via ArticlesRegistry

Examples:
["chroma", "search", "docker basics", 5]
["chroma", "search", "ollama", 3, "docker"]
["chroma", "list", 10]                // top 10 by order
["chroma", "find", "memory-and-dreaming"]
["chroma", "categories"]             // get all categories
["chroma", "tags"]                   // get all tags
["chroma", "nav"]                    // get navigation structure

Subcommands:
- search <query> [limit=5] [tag?] → semantic search, optional tag filter
- list [limit=10]                 → ordered by 'order' field
- find <slug>                     → returns full article (metadata + content)
- categories                      → get all article categories
- tags                            → get all article tags
- nav                             → get navigation structure
`.trim();
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const helpResult = await this.handleHelpRequest(context);
    if (helpResult) {
      return helpResult;
    }
    
    const subcommand = this.getFirstArg(context);
    const rest = this.getArgsArray(context, 1); // everything after subcommand

    if (!subcommand) {
      return { toolName: this.name, success: false, error: 'Missing subcommand' };
    }

    try {
      switch (subcommand) {
        case 'search': {
          const query = rest[0];
          const limit = rest[1] ? parseInt(rest[1], 10) : 5;
          const tagFilter = rest[2];

          const searchOptions: any = { query, limit };
          if (tagFilter) {
            searchOptions.tags = [tagFilter];
          }

          const results = await articlesRegistry.search(searchOptions);

          return {
            toolName: this.name,
            success: true,
            result: {
              items: results.items,
              total: results.total,
              hasMore: results.hasMore
            }
          };
        }

        case 'list': {
          const limit = rest[0] ? parseInt(rest[0], 10) : 10;
          const results = await articlesRegistry.search({ limit, sortBy: 'order', sortOrder: 'asc' });
          return {
            toolName: this.name,
            success: true,
            result: {
              items: results.items,
              total: results.total,
              hasMore: results.hasMore
            }
          };
        }

        case 'find': {
          const slug = rest[0];
          if (!slug) throw new Error('Missing slug');
          
          const article = await articlesRegistry.getBySlug(slug);
          if (!article) return { toolName: this.name, success: false, result: null };

          return {
            toolName: this.name,
            success: true,
            result: article
          };
        }

        case 'categories': {
          const categories = await articlesRegistry.getCategories();
          return { toolName: this.name, success: true, result: categories };
        }

        case 'tags': {
          const tags = await articlesRegistry.getTags();
          return { toolName: this.name, success: true, result: tags };
        }

        case 'nav': {
          const navStructure = await articlesRegistry.getNavStructure();
          return { toolName: this.name, success: true, result: navStructure };
        }

        default:
          return { toolName: this.name, success: false, error: `Unknown subcommand: ${subcommand}` };
      }
    } catch (err: any) {
      return { toolName: this.name, success: false, error: err.message || String(err) };
    }
  }
}