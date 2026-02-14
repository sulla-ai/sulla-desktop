import type { ThreadState, ToolResult } from '../../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { articlesRegistry } from '../../database/registry/ArticlesRegistry';

export class KnowledgeGraphTool extends BaseTool {
  override readonly name = 'knowledge-graph';
  override readonly aliases = ['kg', 'knowledgebase', 'memory', 'storage', 'graph'];

  override getPlanningInstructions(): string {
    return `["knowledge-graph", "search", "query"] - Knowledge graph articles and relationships via ArticlesRegistry

Examples:
["knowledge-graph", "search", "docker basics", 5]
["knowledge-graph", "search", "ollama", 3, "docker"]
["knowledge-graph", "list", 10]                // top 10 by order
["knowledge-graph", "find", "memory-and-dreaming"]
["knowledge-graph", "related", "architecture-overview", "MENTIONS"]
["knowledge-graph", "categories"]             // get all categories
["knowledge-graph", "tags"]                   // get all tags
["knowledge-graph", "nav"]                    // get navigation structure

Subcommands:
- search <query> [limit=5] [tag?] → semantic search, optional tag filter
- list [limit=10]                 → ordered by 'order' field
- find <slug>                     → returns full article (metadata + content)
- related <slug> [relationship=MENTIONS] → get related articles by graph relationship
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

        case 'related': {
          const slug = rest[0];
          const relationship = rest[1] || 'MENTIONS';
          if (!slug) throw new Error('Missing slug');

          const relatedArticles = await articlesRegistry.getRelated(slug, relationship);

          return {
            toolName: this.name,
            success: true,
            result: {
              slug,
              relationship,
              related: relatedArticles
            }
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
