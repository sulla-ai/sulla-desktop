import { BaseTool, ToolResponse } from "../base";
import { Article } from "../../database/models/Article";

/**
 * Article Find Tool - Worker class for execution
 */
export class ArticleFindWorker extends BaseTool {
  name: string = '';
  description: string = '';
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { slug } = input;

    try {
      const article = await Article.find(slug);
      if (!article) {
        return {
          successBoolean: false,
          responseString: `Article with slug "${slug}" not found.`
        };
      }

      const createdDate = new Date(article.attributes.created_at).toLocaleString();
      const updatedDate = new Date(article.attributes.updated_at).toLocaleString();

      const responseString = `Article Found:
Slug: ${article.attributes.slug}
Title: ${article.attributes.title}
Section: ${article.attributes.section || 'N/A'}
Category: ${article.attributes.category || 'N/A'}
Tags: ${article.attributes.tags || 'None'}
Order: ${article.attributes.order}
Locked: ${article.attributes.locked ? 'Yes' : 'No'}
Author: ${article.attributes.author}
Related Slugs: ${article.attributes.related_slugs || 'None'}
Mentions: ${article.attributes.mentions || 'None'}
Related Entities: ${article.attributes.related_entities || 'None'}
Created: ${createdDate}
Updated: ${updatedDate}

Content:
${article.attributes.document}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          successBoolean: false,
          responseString: `Error finding article: ${error.message}`
        };
      } else {
        return {
          successBoolean: false,
          responseString: 'Error finding article: Unknown error'
        };
      }
    }
  }
}
