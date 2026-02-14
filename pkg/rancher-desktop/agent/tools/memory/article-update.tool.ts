import { BaseTool } from "../base";
import { z } from "zod";
import { Article } from "../../database/models/Article";

export class ArticleUpdateTool extends BaseTool {
  name = "article_update";
  description = "Update an existing article's metadata. Note: content updates require full replacement.";
  schema = z.object({
    slug: z.string().describe("Slug of the article to update"),
    title: z.string().optional().describe("New title for the article"),
    content: z.string().optional().describe("New full markdown content (replaces existing)"),
    section: z.string().optional().describe("New section"),
    category: z.string().optional().describe("New category"),
    tags: z.array(z.string()).optional().describe("New array of tags"),
    order: z.string().optional().describe("New order field"),
    locked: z.boolean().optional().describe("New locked status"),
    author: z.string().optional().describe("New author"),
    related_slugs: z.array(z.string()).optional().describe("New array of related slugs"),
    mentions: z.array(z.string()).optional().describe("New array of mentions"),
    related_entities: z.array(z.string()).optional().describe("New array of related entities"),
  });

  metadata = { category: "memory" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { slug, title, content, section, category, tags, order, locked, author, related_slugs, mentions, related_entities } = input;

    try {
      const existing = await Article.find(slug);
      if (!existing) {
        return `Article with slug "${slug}" not found.`;
      }

      const updates: any = {
        updated_at: new Date().toISOString(),
      };

      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.document = content;
      if (section !== undefined) updates.section = section;
      if (category !== undefined) updates.category = category;
      if (tags !== undefined) updates.tags = tags;
      if (order !== undefined) updates.order = order;
      if (author !== undefined) updates.author = author;
      if (related_slugs !== undefined) updates.related_slugs = related_slugs;
      if (mentions !== undefined) updates.mentions = mentions;
      if (related_entities !== undefined) updates.related_entities = related_entities;

      existing.fill(updates);
      await existing.save();

      return {
        success: true,
        slug,
        message: `Article "${slug}" updated successfully.`,
        updated_fields: Object.keys(updates),
      };
    } catch (error) {
      return `Error updating article: ${(error as Error).message}`;
    }
  }
}
