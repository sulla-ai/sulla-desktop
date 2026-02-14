import { BaseTool } from "../base";
import { z } from "zod";
import { Article } from "../../database/models/Article";

export class ArticleFindTool extends BaseTool {
  name = "article_find";
  description = "Find an article by slug.";
  schema = z.object({
    slug: z.string().describe("The slug of the article to find"),
  });

  metadata = { category: "memory" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { slug } = input;

    try {
      const article = await Article.find(slug);
      return article;
    } catch (error) {
      return `Error finding article: ${(error as Error).message}`;
    }
  }
}
