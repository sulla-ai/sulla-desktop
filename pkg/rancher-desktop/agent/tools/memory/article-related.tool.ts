import { BaseTool } from "../base";
import { z } from "zod";
import { articlesRegistry } from "../../database/registry/ArticlesRegistry";

export class ArticleRelatedTool extends BaseTool {
  name = "article_related";
  description = "Get related articles by graph relationship.";
  schema = z.object({
    slug: z.string().describe("The slug of the article"),
    relationship: z.string().optional().describe("Relationship type (default: MENTIONS)"),
  });

  metadata = { category: "memory" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { slug, relationship = 'MENTIONS' } = input;

    try {
      const relatedArticles = await articlesRegistry.getRelated(slug, relationship);
      return {
        slug,
        relationship,
        related: relatedArticles,
      };
    } catch (error) {
      return `Error getting related articles: ${(error as Error).message}`;
    }
  }
}
