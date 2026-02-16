import { BaseTool, ToolRegistration } from "../base";
import { Article } from "../../database/models/Article";

/**
 * Article Update Tool - Worker class for execution
 */
export class ArticleUpdateWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { slug, title, content, section, category, tags, order, locked, author, related_slugs, mentions, related_entities } = input;

    try {
      const existing = await Article.find(slug);
      if (!existing) {
        return `Article with slug "${slug}" not found.`;
      }

      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.document = content;
      if (section !== undefined) updates.section = section;
      if (category !== undefined) updates.category = category;
      if (tags !== undefined) updates.tags = tags.join(',');
      if (order !== undefined) updates.order = order;
      if (locked !== undefined) updates.locked = locked;
      if (author !== undefined) updates.author = author;
      if (related_slugs !== undefined) updates.related_slugs = related_slugs.join(',');
      if (mentions !== undefined) updates.mentions = mentions.join(',');
      if (related_entities !== undefined) updates.related_entities = related_entities.join(',');

      existing.attributes = { ...existing.attributes, ...updates };
      await existing.save();

      return {
        success: true,
        slug,
        message: `Article "${slug}" updated successfully.`,
      };
    } catch (error) {
      if (error instanceof Error) {
        return `Error updating article: ${error.message}`;
      } else {
        return 'Error updating article: Unknown error';
      }
    }
  }
}

// Export the complete tool registration with type enforcement
export const articleUpdateRegistration: ToolRegistration = {
  name: "article_update",
  description: "Update an existing article's metadata. Note: content updates require full replacement.",
  category: "memory",
  schemaDef: {
    slug: { type: 'string' as const, description: "Slug of the article to update" },
    title: { type: 'string' as const, optional: true, description: "New title for the article" },
    content: { type: 'string' as const, optional: true, description: "New full markdown content (replaces existing)" },
    section: { type: 'string' as const, optional: true, description: "New section" },
    category: { type: 'string' as const, optional: true, description: "New category" },
    tags: { type: 'array' as const, items: { type: 'string' as const }, optional: true, description: "New array of tags" },
    order: { type: 'string' as const, optional: true, description: "New order field" },
    locked: { type: 'boolean' as const, optional: true, description: "New locked status" },
    author: { type: 'string' as const, optional: true, description: "New author" },
    related_slugs: { type: 'array' as const, items: { type: 'string' as const }, optional: true, description: "New array of related slugs" },
    mentions: { type: 'array' as const, items: { type: 'string' as const }, optional: true, description: "New array of mentions" },
    related_entities: { type: 'array' as const, items: { type: 'string' as const }, optional: true, description: "New array of related entities" },
  },
  workerClass: ArticleUpdateWorker,
};
