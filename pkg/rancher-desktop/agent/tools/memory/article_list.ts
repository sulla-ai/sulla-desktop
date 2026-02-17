import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { ArticlesRegistry } from "../../database/registry/ArticlesRegistry";

/**
 * Article List Tool - Worker class for execution
 */
export class ArticleListWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { limit = 10 } = input;

    try {
      const registry = ArticlesRegistry.getInstance();
      const result = await registry.search({ limit, sortBy: 'order', sortOrder: 'asc' });

      if (result.items.length === 0) {
        return {
          successBoolean: false,
          responseString: "No articles found."
        };
      }

      // Format detailed list of articles
      let responseString = `Articles (limit: ${limit}, sorted by order):\n\n`;
      result.items.forEach((article: any, index: number) => {
        responseString += `${index + 1}. Slug: ${article.slug}\n`;
        responseString += `   Title: ${article.title}\n`;
        responseString += `   Section: ${article.section || 'N/A'}\n`;
        responseString += `   Category: ${article.category || 'N/A'}\n`;
        responseString += `   Tags: ${article.tags || 'None'}\n`;
        responseString += `   Order: ${article.order}\n`;
        responseString += `   Locked: ${article.locked ? 'Yes' : 'No'}\n`;
        responseString += `   Author: ${article.author}\n\n`;
      });

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error listing articles: ${(error as Error).message}`
      };
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
