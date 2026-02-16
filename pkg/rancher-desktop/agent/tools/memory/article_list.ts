import { BaseTool, ToolRegistration } from "../base";
import { ArticlesRegistry } from "../../database/registry/ArticlesRegistry";

/**
 * Article List Tool - Worker class for execution
 */
export class ArticleListWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { limit = 10 } = input;

    try {
      const registry = ArticlesRegistry.getInstance();
      const result = await registry.search({ limit, sortBy: 'order', sortOrder: 'asc' });

      if (result.items.length === 0) {
        return "No articles found.";
      }

      return result.items;
    } catch (error) {
      return `Error listing articles: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const articleListRegistration: ToolRegistration = {
  name: "article_list",
  description: "List articles ordered by their order field. Returns article metadata without full content.",
  category: "memory",
  schemaDef: {
    limit: { type: 'number' as const, optional: true, default: 10, description: "Maximum number of articles to return" },
  },
  workerClass: ArticleListWorker,
};
