import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Get Template Workflow Tool - Worker class for execution
 */
export class GetTemplateWorkflowWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const template = await service.getTemplateWorkflow(input.id);

      const responseString = `Template Workflow Details:
ID: ${template.id}
Name: ${template.name}
Description: ${template.description || 'N/A'}
Category: ${template.category || 'N/A'}
Tags: ${(template.tags || []).join(', ') || 'None'}
Nodes: ${template.nodes?.length || 0}
Created: ${template.createdAt ? new Date(template.createdAt).toLocaleString() : 'N/A'}
Updated: ${template.updatedAt ? new Date(template.updatedAt).toLocaleString() : 'N/A'}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error getting template workflow: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const getTemplateWorkflowRegistration: ToolRegistration = {
  name: "get_template_workflow",
  description: "Get the details of a single n8n workflow template by its ID from the public n8n template library.",
  category: "n8n",
  operationTypes: ['read'],
  schemaDef: {
    id: { type: 'number' as const, description: "Template workflow ID" },
  },
  workerClass: GetTemplateWorkflowWorker,
};
