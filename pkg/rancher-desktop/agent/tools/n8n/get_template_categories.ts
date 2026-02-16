import { BaseTool, ToolRegistration } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Get Template Categories Tool - Worker class for execution
 */
export class GetTemplateCategoriesWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const service = await createN8nService();
    return await service.getTemplateCategories();
  }
}

// Export the complete tool registration with type enforcement
export const getTemplateCategoriesRegistration: ToolRegistration = {
  name: "get_template_categories",
  description: "List all available n8n template categories from the public n8n template library.",
  category: "n8n",
  schemaDef: {},
  workerClass: GetTemplateCategoriesWorker,
};
