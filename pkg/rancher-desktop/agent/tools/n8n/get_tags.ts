import { BaseTool, ToolRegistration } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Get Tags Tool - Worker class for execution
 */
export class GetTagsWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const service = await createN8nService();
    return await service.getTags();
  }
}

// Export the complete tool registration with type enforcement
export const getTagsRegistration: ToolRegistration = {
  name: "get_tags",
  description: "Get all tags from n8n.",
  category: "n8n",
  schemaDef: {},
  workerClass: GetTagsWorker,
};
