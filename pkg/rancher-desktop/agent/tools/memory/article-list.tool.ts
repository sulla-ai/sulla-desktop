import { BaseTool } from "../base";
import { z } from "zod";
import { articlesRegistry } from "../../database/registry/ArticlesRegistry";

export class ArticleListTool extends BaseTool {
  name = "article_list";
  description = "List articles.";
  schema = z.object({
    limit: z.number().optional().describe("Maximum number of articles to list"),
  });

  metadata = { category: "memory" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { limit } = input;

    try {
      const results = await articlesRegistry.search({ limit, sortBy: 'order', sortOrder: 'asc' });
      return {
        items: results.items,
        total: results.total,
        hasMore: results.hasMore,
      };
    } catch (error) {
      return `Error listing articles: ${(error as Error).message}`;
    }
  }
}
