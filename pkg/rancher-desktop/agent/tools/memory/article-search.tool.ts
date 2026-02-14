import { BaseTool } from "../base";
import { z } from "zod";
import { ArticlesRegistry } from "../../database/registry/ArticlesRegistry";

export class ArticleSearchTool extends BaseTool {
  name = "article_search";
  description = "Perform semantic search on articles by query. Returns matching articles with metadata and relevance scores.";
  schema = z.object({
    query: z.string().describe("The search query to find relevant articles"),
    limit: z.number().optional().default(5).describe("Maximum number of results to return"),
    tag: z.string().optional().describe("Optional tag filter to narrow search results"),
  });

  metadata = { category: "memory" };

  protected async _call(input: z.infer<this["schema"]>) {
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
