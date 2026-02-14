import { BaseTool } from "../base";
import { z } from "zod";
import { ArticlesRegistry } from "../../database/registry/ArticlesRegistry";

export class ArticleFindRelatedTool extends BaseTool {
  name = "article_find_related";
  description = "Find articles related to a given slug via graph relationships. Returns up to 10 related articles by default.";
  schema = z.object({
    slug: z.string().describe("The slug of the article to find related articles for"),
    relType: z.string().optional().default("MENTIONS").describe("Type of relationship to search (e.g., MENTIONS)"),
    limit: z.number().optional().default(10).describe("Maximum number of related articles to return"),
  });

  metadata = { category: "memory" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { slug, relType = "MENTIONS", limit = 10 } = input;

    try {
      const registry = ArticlesRegistry.getInstance();
      const related = await registry.getRelated(slug, relType, limit);

      if (related.length === 0) {
        return `No related articles found for "${slug}" with relationship "${relType}".`;
      }

      return related;
    } catch (error) {
      return `Error finding related articles: ${(error as Error).message}`;
    }
  }
}
