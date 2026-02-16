import { BaseTool, ToolRegistration } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Get Template Workflow Tool - Worker class for execution
 */
export class GetTemplateWorkflowWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const service = await createN8nService();
    return await service.getTemplateWorkflow(input.id);
  }
}

// Export the complete tool registration with type enforcement
export const getTemplateWorkflowRegistration: ToolRegistration = {
  name: "get_template_workflow",
  description: "Get the details of a single n8n workflow template by its ID from the public n8n template library.",
  category: "n8n",
  schemaDef: {
    id: { type: 'number' as const, description: "Template workflow ID" },
  },
  workerClass: GetTemplateWorkflowWorker,
};
