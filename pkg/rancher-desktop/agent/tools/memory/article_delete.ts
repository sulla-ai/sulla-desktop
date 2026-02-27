import { BaseTool, ToolResponse } from "../base";
import { Article } from "../../database/models/Article";

/**
 * Article Delete Tool - Worker class for execution
 */
export class ArticleDeleteWorker extends BaseTool {
  name: string = '';
  description: string = '';
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
