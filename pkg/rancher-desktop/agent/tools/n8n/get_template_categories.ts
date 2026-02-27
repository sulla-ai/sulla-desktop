import { BaseTool, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Get Template Categories Tool - Worker class for execution
 */
export class GetTemplateCategoriesWorker extends BaseTool {
  name: string = '';
  description: string = '';
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const categories = await service.getTemplateCategories();

      if (!categories || categories.length === 0) {
        return {
          successBoolean: false,
          responseString: 'No template categories found.'
        };
      }

      let responseString = `n8n Template Categories (${categories.length} found):\n\n`;
      categories.forEach((category: any, index: number) => {
        responseString += `${index + 1}. Name: ${category.name}\n`;
        responseString += `   ID: ${category.id}\n`;
        responseString += `   Description: ${category.description || 'N/A'}\n\n`;
      });

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error getting template categories: ${(error as Error).message}`
      };
    }
  }
}
