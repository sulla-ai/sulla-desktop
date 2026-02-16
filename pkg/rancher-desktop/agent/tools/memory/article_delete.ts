import { BaseTool, ToolRegistration } from "../base";
import { Article } from "../../database/models/Article";

/**
 * Article Delete Tool - Worker class for execution
 */
export class ArticleDeleteWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { slug } = input;

    try {
      const article = await Article.find(slug);
      if (!article) {
        return `Article with slug "${slug}" not found.`;
      }

      await article.delete();

      return {
        success: true,
        slug,
        message: `Article "${slug}" deleted successfully.`,
      };
    } catch (error) {
      if (error instanceof Error) {
        return `Error deleting article: ${error.message}`;
      } else {
        return 'Error deleting article: Unknown error';
      }
    }
  }
}

// Export the complete tool registration with type enforcement
export const articleDeleteRegistration: ToolRegistration = {
  name: "article_delete",
  description: "Delete an article from the knowledge base by its slug. This action is permanent.",
  category: "memory",
  schemaDef: {
    slug: { type: 'string' as const, description: "Slug of the article to delete" },
  },
  workerClass: ArticleDeleteWorker,
};
