import { BaseTool } from "../base";
import { z } from "zod";
import { Article } from "../../database/models/Article";

export class ArticleCreateTool extends BaseTool {
  name = "article_create";
  description = "Create a new article.";
  schema = z.object({
    slug: z.string().describe("The slug for the new article"),
    title: z.string().describe("The title of the article"),
    content: z.string().describe("The content of the article"),
    tags: z.string().optional().describe("Comma-separated tags"),
    order: z.number().optional().describe("Display order"),
    locked: z.boolean().optional().describe("Whether the article is locked"),
    author: z.string().optional().describe("Author of the article"),
  });

  metadata = { category: "memory" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { slug, title, content, tags, order, locked, author } = input;

    try {
      const article = await Article.create({
        slug,
        title,
        content,
        tags: tags ? tags.split(',') : undefined,
        order,
        locked,
        author,
      });
      return article;
    } catch (error) {
      return `Error creating article: ${(error as Error).message}`;
    }
  }
}
