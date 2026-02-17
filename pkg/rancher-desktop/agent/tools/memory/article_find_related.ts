import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { ArticlesRegistry } from "../../database/registry/ArticlesRegistry";

/**
 * Article Find Related Tool - Worker class for execution
 */
export class ArticleFindRelatedWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { slug, relType = "MENTIONS", limit = 10 } = input;

    try {
      const registry = ArticlesRegistry.getInstance();
      const related = await registry.getRelated(slug, relType, limit);

      if (related.length === 0) {
        return {
          successBoolean: false,
          responseString: `No related articles found for "${slug}" with relationship "${relType}".`
        };
      }

      // Format detailed list of related articles
      let responseString = `Related articles for "${slug}" (${relType}, limit: ${limit}):\n\n`;
      related.forEach((article: any, index: number) => {
        responseString += `${index + 1}. Slug: ${article.slug}\n`;
        responseString += `   Title: ${article.title}\n`;
        responseString += `   Section: ${article.section || 'N/A'}\n`;
        responseString += `   Category: ${article.category || 'N/A'}\n`;
        responseString += `   Tags: ${article.tags || 'None'}\n`;
        responseString += `   Similarity/Relevance: ${article.similarity || article.relevance || 'N/A'}\n\n`;
      });

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error finding related articles: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const articleFindRelatedRegistration: ToolRegistration = {
  name: "article_find_related",
  description: "Find articles related to a given slug via graph relationships. Returns up to 10 related articles by default.",
  category: "memory",
  schemaDef: {
    slug: { type: 'string' as const, description: "The slug of the article to find related articles for" },
    relType: { type: 'string' as const, optional: true, default: "MENTIONS", description: "Type of relationship to search (e.g., MENTIONS)" },
    limit: { type: 'number' as const, optional: true, default: 10, description: "Maximum number of related articles to return" },
  },
  workerClass: ArticleFindRelatedWorker,
};
