import { BaseTool } from "../base";
import { z } from "zod";
import { Article } from "../../database/models/Article";

export class ArticleFindTool extends BaseTool {
  name = "article_find";
  description = "Find and retrieve a single article by its slug. Returns the full article metadata and content.";
  schema = z.object({
    slug: z.string().describe("The unique slug identifier of the article to find"),
  });

  metadata = { category: "memory" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { slug } = input;

    try {
      const article = await Article.find(slug);
      if (!article) {
        return `Article with slug "${slug}" not found.`;
      }

      return {
        slug: article.attributes.slug,
        title: article.attributes.title,
        section: article.attributes.section,
        category: article.attributes.category,
        tags: article.attributes.tags,
        order: article.attributes.order,
        locked: article.attributes.locked,
        author: article.attributes.author,
        related_slugs: article.attributes.related_slugs,
        mentions: article.attributes.mentions,
        related_entities: article.attributes.related_entities,
        created_at: article.attributes.created_at,
        updated_at: article.attributes.updated_at,
        content: article.attributes.document,
      };
    } catch (error) {
      if (error instanceof Error) {
        return `Error finding article: ${error.message}`;
      } else {
        return 'Error finding article: Unknown error';
      }
    }
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('article_find', async () => new ArticleFindTool(), 'memory');
