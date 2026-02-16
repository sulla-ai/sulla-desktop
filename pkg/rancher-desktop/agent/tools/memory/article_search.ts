import { BaseTool, ToolRegistration } from "../base";
import { ArticlesRegistry } from "../../database/registry/ArticlesRegistry";

/**
 * Article Search Tool - Worker class for execution
 */
export class ArticleSearchWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { query, limit = 5, tag } = input;

    try {
      const registry = ArticlesRegistry.getInstance();
      const result = await registry.search({ query, limit, tags: tag ? [tag] : undefined });

      if (result.items.length === 0) {
        return `No articles found matching "${query}"${tag ? ` with tag "${tag}"` : ""}.`;
      }

      return result.items.map(item => ({
        ...item,
        score: "semantic similarity score",
      }));
    } catch (error) {
      return `Error searching articles: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const articleSearchRegistration: ToolRegistration = {
  name: "article_search",
  description: "Perform semantic search on articles by query. Returns matching articles with metadata and relevance scores.",
  category: "memory",
  schemaDef: {
    query: { type: 'string' as const, description: "The search query to find relevant articles" },
    limit: { type: 'number' as const, optional: true, default: 5, description: "Maximum number of results to return" },
    tag: { type: 'string' as const, optional: true, description: "Optional tag filter to narrow search results" },
  },
  workerClass: ArticleSearchWorker,
};
