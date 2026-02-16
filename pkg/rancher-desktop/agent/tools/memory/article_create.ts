import { BaseTool, ToolRegistration } from "../base";
import { Article } from "../../database/models/Article";

/**
 * Article Create Tool - Worker class for execution
 */
export class ArticleCreateWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const {
      slug,
      title,
      content,
      section,
      category,
      tags = "",
      order = "100",
      locked = false,
      author = "Jonathon Byrdziak",
      related_slugs = "",
      mentions = "",
      related_entities = "",
    } = input;

    try {
      const existing = await Article.find(slug);
      if (existing) {
        return `Article with slug "${slug}" already exists.`;
      }

      const article = Article.create({
        slug,
        title,
        document: content,
        section,
        category,
        tags,
        order,
        locked,
        author,
        related_slugs,
        mentions,
        related_entities,
      });

      return {
        success: true,
        slug,
        title,
        message: `Article "${title}" created successfully.`,
      };
    } catch (error) {
      if (error instanceof Error) {
        return `Error creating article: ${error.message}`;
      } else {
        return 'Error creating article: Unknown error';
      }
    }
  }
}

// Export the complete tool registration with type enforcement
export const articleCreateRegistration: ToolRegistration = {
  name: "article_create",
  description: "Create a new article in the knowledge base with the specified content and metadata.",
  category: "memory",
  schemaDef: {
    slug: { type: 'string' as const, description: "Unique slug identifier for the article" },
    title: { type: 'string' as const, description: "Title of the article" },
    content: { type: 'string' as const, description: "Full markdown content of the article" },
    section: { type: 'string' as const, optional: true, description: "Section this article belongs to" },
    category: { type: 'string' as const, optional: true, description: "Category within the section" },
    tags: { type: 'string' as const, optional: true, default: "", description: "Comma-separated list of tags for the article" },
    order: { type: 'string' as const, optional: true, default: "100", description: "Order field for sorting (string)" },
    locked: { type: 'boolean' as const, optional: true, default: false, description: "Whether the article is locked for editing" },
    author: { type: 'string' as const, optional: true, default: "Jonathon Byrdziak", description: "Author of the article" },
    related_slugs: { type: 'string' as const, optional: true, default: "", description: "Comma-separated legacy related slugs" },
    mentions: { type: 'string' as const, optional: true, default: "", description: "Comma-separated slugs/entities mentioned" },
    related_entities: { type: 'string' as const, optional: true, default: "", description: "Comma-separated related entity IDs/names" },
  },
  workerClass: ArticleCreateWorker,
};
