import { BaseTool } from "../base";
import { z } from "zod";
import { ArticlesRegistry } from "../../database/registry/ArticlesRegistry";

export class ArticleListTool extends BaseTool {
  name = "article_list";
  description = "List articles ordered by their order field. Returns article metadata without full content.";
  schema = z.object({
    limit: z.number().optional().default(10).describe("Maximum number of articles to return"),
  });

  metadata = { category: "memory" };

  protected async _call(input: z.infer<this["schema"]>) {
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
