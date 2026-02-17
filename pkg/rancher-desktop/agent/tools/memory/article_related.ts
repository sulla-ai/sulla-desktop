import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { ArticlesRegistry } from "../../database/registry/ArticlesRegistry";

/**
 * Article Related Tool - Worker class for execution
 */
export class ArticleRelatedWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { slug, relationship = 'MENTIONS' } = input;

    try {
      const relatedArticles = await ArticlesRegistry.getInstance().getRelated(slug, relationship);

      if (!relatedArticles || relatedArticles.length === 0) {
        return {
          successBoolean: false,
          responseString: `No related articles found for "${slug}" with relationship "${relationship}".`
        };
      }

      // Format detailed list of related articles
      let responseString = `Related articles for "${slug}" (${relationship}):\n\n`;
      relatedArticles.forEach((article: any, index: number) => {
        responseString += `${index + 1}. Slug: ${article.slug}\n`;
        responseString += `   Title: ${article.title}\n`;
        responseString += `   Section: ${article.section || 'N/A'}\n`;
        responseString += `   Category: ${article.category || 'N/A'}\n`;
        responseString += `   Tags: ${article.tags || 'None'}\n`;
        responseString += `   Relationship Strength: ${article.relationshipStrength || 'N/A'}\n\n`;
      });

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error getting related articles: ${(error as Error).message}`
      };
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
