import { BaseTool } from "../base";
import { z } from "zod";
import { Article } from "../../database/models/Article";

export class ArticleCreateTool extends BaseTool {
  name = "article_create";
  description = "Create a new article in the knowledge base with the specified content and metadata.";
  schema = z.object({
    slug: z.string().describe("Unique slug identifier for the article"),
    title: z.string().describe("Title of the article"),
    content: z.string().describe("Full markdown content of the article"),
    section: z.string().optional().describe("Section this article belongs to"),
    category: z.string().optional().describe("Category within the section"),
    tags: z.string().optional().default("").describe("Comma-separated list of tags for the article"),
    order: z.string().optional().default("100").describe("Order field for sorting (string)"),
    locked: z.boolean().optional().default(false).describe("Whether the article is locked for editing"),
    author: z.string().optional().default("Jonathon Byrdziak").describe("Author of the article"),
    related_slugs: z.string().optional().default("").describe("Comma-separated legacy related slugs"),
    mentions: z.string().optional().default("").describe("Comma-separated slugs/entities mentioned"),
    related_entities: z.string().optional().default("").describe("Comma-separated related entity IDs/names"),
  });

  metadata = { category: "memory" };

  protected async _call(input: z.infer<this["schema"]>) {
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
      related_entities = ""
    } = input;

    try {
      const article = new Article();
      article.fill({
        schemaversion: 1,
        slug,
        title,
        document: content,
        section,
        category,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        order,
        locked,
        author,
        related_slugs: related_slugs ? related_slugs.split(',').map(s => s.trim()) : [],
        mentions: mentions ? mentions.split(',').map(m => m.trim()) : [],
        related_entities: related_entities ? related_entities.split(',').map(e => e.trim()) : [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await article.save();

      return {
        success: true,
        slug: article.attributes.slug,
        message: `Article "${title}" created successfully with slug "${slug}".`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error creating article: ${errorMessage}`;
    }
  }
}
