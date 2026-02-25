import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Get Template Collections Tool - Worker class for execution
 */
export class GetTemplateCollectionsWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const collections = await service.getTemplateCollections({
        page: input.page,
        limit: input.limit,
      });

      if (!collections || collections.length === 0) {
        return {
          successBoolean: false,
          responseString: 'No template collections found.'
        };
      }

      let responseString = `n8n Template Collections (${collections.length} found):\n\n`;
      collections.forEach((collection: any, index: number) => {
        responseString += `${index + 1}. Name: ${collection.name}\n`;
        responseString += `   ID: ${collection.id}\n`;
        responseString += `   Description: ${collection.description || 'N/A'}\n`;
        responseString += `   Category: ${collection.category || 'N/A'}\n`;
        responseString += `   Templates: ${collection.templates?.length || 0}\n\n`;
      });

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error getting template collections: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const getTemplateCollectionsRegistration: ToolRegistration = {
  name: "get_template_collections",
  description: "Browse n8n template collections from the public n8n template library. Supports pagination.",
  category: "n8n",
  operationTypes: ['read'],
  schemaDef: {
    page: { type: 'number' as const, optional: true, description: "Page number for pagination" },
    limit: { type: 'number' as const, optional: true, description: "Number of results per page" },
  },
  workerClass: GetTemplateCollectionsWorker,
};
