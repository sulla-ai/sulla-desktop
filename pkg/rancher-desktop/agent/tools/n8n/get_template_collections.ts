import { BaseTool, ToolRegistration } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Get Template Collections Tool - Worker class for execution
 */
export class GetTemplateCollectionsWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const service = await createN8nService();
    return await service.getTemplateCollections({
      page: input.page,
      limit: input.limit,
    });
  }
}

// Export the complete tool registration with type enforcement
export const getTemplateCollectionsRegistration: ToolRegistration = {
  name: "get_template_collections",
  description: "Browse n8n template collections from the public n8n template library. Supports pagination.",
  category: "n8n",
  schemaDef: {
    page: { type: 'number' as const, optional: true, description: "Page number for pagination" },
    limit: { type: 'number' as const, optional: true, description: "Number of results per page" },
  },
  workerClass: GetTemplateCollectionsWorker,
};
