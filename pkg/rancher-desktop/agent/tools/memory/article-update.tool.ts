import { BaseTool } from "../base";
import { z } from "zod";
import { Article } from "../../database/models/Article";

export class ArticleUpdateTool extends BaseTool {
  name = "article_update";
  description = "Update an existing article.";
  schema = z.object({
    slug: z.string().describe("The slug of the article to update"),
    title: z.string().optional().describe("New title"),
    content: z.string().optional().describe("New content"),
    tags: z.string().optional().describe("New comma-separated tags"),
    order: z.number().optional().describe("New display order"),
    locked: z.boolean().optional().describe("New locked status"),
    author: z.string().optional().describe("New author"),
  });

  metadata = { category: "memory" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { slug, title, content, tags, order, locked, author } = input;

    try {
      const article = await Article.find(slug);
      if (!article) {
        throw new Error('Article not found');
      }

      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.content = content;
      if (tags !== undefined) updates.tags = tags.split(',');
      if (order !== undefined) updates.order = order;
      if (locked !== undefined) updates.locked = locked;
      if (author !== undefined) updates.author = author;

      // Apply updates
      Object.assign(article, updates);

      // Save the article
      await article.save();

      return article;
    } catch (error) {
      return `Error updating article: ${(error as Error).message}`;
    }
  }
}
