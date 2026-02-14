import { BaseTool } from "../base";
import { z } from "zod";
import { Article } from "../../database/models/Article";

export class ArticleDeleteTool extends BaseTool {
  name = "article_delete";
  description = "Delete an article.";
  schema = z.object({
    slug: z.string().describe("The slug of the article to delete"),
  });

  metadata = { category: "memory" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { slug } = input;

    try {
      const article = await Article.find(slug);
      if (!article) {
        throw new Error('Article not found');
      }

      await article.delete();
      return { deleted: true };
    } catch (error) {
      return `Error deleting article: ${(error as Error).message}`;
    }
  }
}
