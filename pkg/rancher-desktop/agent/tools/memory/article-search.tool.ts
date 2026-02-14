import { BaseTool } from "../base";
import { z } from "zod";
import { articlesRegistry } from "../../database/registry/ArticlesRegistry";

export class ArticleSearchTool extends BaseTool {
  name = "article_search";
  description = "Search for articles semantically.";
  schema = z.object({
    query: z.string().describe("The search query"),
    limit: z.number().optional().describe("Maximum number of results"),
    tag: z.string().optional().describe("Filter by tag"),
  });

  metadata = { category: "memory" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { query, limit, tag } = input;

    try {
      const searchOptions: any = { query, limit };
      if (tag) {
        searchOptions.tags = [tag];
      }
      const results = await articlesRegistry.search(searchOptions);
      return {
        items: results.items,
        total: results.total,
        hasMore: results.hasMore,
      };
    } catch (error) {
      return `Error searching articles: ${(error as Error).message}`;
    }
  }
}
