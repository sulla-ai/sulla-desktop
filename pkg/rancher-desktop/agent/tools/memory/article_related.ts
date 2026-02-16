import { BaseTool, ToolRegistration } from "../base";
import { ArticlesRegistry } from "../../database/registry/ArticlesRegistry";

/**
 * Article Related Tool - Worker class for execution
 */
export class ArticleRelatedWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { slug, relationship = 'MENTIONS' } = input;

    try {
      const relatedArticles = await ArticlesRegistry.getInstance().getRelated(slug, relationship);
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

// Export the complete tool registration with type enforcement
export const articleRelatedRegistration: ToolRegistration = {
  name: "article_related",
  description: "Get related articles by graph relationship.",
  category: "memory",
  schemaDef: {
    slug: { type: 'string' as const, description: "The slug of the article" },
    relationship: { type: 'string' as const, optional: true, description: "Relationship type (default: MENTIONS)" },
  },
  workerClass: ArticleRelatedWorker,
};
