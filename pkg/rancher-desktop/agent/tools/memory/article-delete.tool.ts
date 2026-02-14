import { BaseTool } from "../base";
import { z } from "zod";
import { Article } from "../../database/models/Article";

export class ArticleDeleteTool extends BaseTool {
  name = "article_delete";
  description = "Delete an article from the knowledge base by its slug. This action is permanent.";
  schema = z.object({
    slug: z.string().describe("Slug of the article to delete"),
  });

  metadata = { category: "memory" };

  protected async _call(input: z.infer<this["schema"]>) {
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error deleting article: ${errorMessage}`;
    }
  }
}
