import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { Article } from "../../database/models/Article";

/**
 * Article Delete Tool - Worker class for execution
 */
export class ArticleDeleteWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { slug } = input;

    try {
      const article = await Article.find(slug);
      if (!article) {
        return {
          successBoolean: false,
          responseString: `Article with slug "${slug}" not found.`
        };
      }

      await article.delete();

      return {
        successBoolean: true,
        responseString: `Article deleted successfully:
Slug: ${slug}
Title: ${article.attributes.title}`
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          successBoolean: false,
          responseString: `Error deleting article: ${error.message}`
        };
      } else {
        return {
          successBoolean: false,
          responseString: 'Error deleting article: Unknown error'
        };
      }
    }
  }
}

// Export the complete tool registration with type enforcement
export const articleDeleteRegistration: ToolRegistration = {
  name: "article_delete",
  description: "Delete an article from the knowledge base by its slug. This action is permanent.",
  category: "memory",
  operationTypes: ['delete'],
  schemaDef: {
    slug: { type: 'string' as const, description: "Slug of the article to delete" },
  },
  workerClass: ArticleDeleteWorker,
};
