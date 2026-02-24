import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Get Workflows Tool - Worker class for execution
 */
export class GetWorkflowsWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const result = await service.getWorkflows(input);
      const workflows = result;

      if (!workflows || workflows.length === 0) {
        return {
          successBoolean: false,
          responseString: `No workflows found with the specified filters.`
        };
      }

      let responseString = `n8n Workflows (${workflows.length} found):\n\n`;
      workflows.forEach((workflow: any, index: number) => {
        responseString += `${index + 1}. ID: ${workflow.id}\n`;
        responseString += `   Name: ${workflow.name}\n`;
        responseString += `   Active: ${workflow.active ? 'Yes' : 'No'}\n`;
        responseString += `   Created: ${new Date(workflow.createdAt).toLocaleString()}\n`;
        responseString += `   Updated: ${new Date(workflow.updatedAt).toLocaleString()}\n`;
        responseString += `   Tags: ${(workflow.tags || []).map((tag: any) => tag.name).join(', ') || 'None'}\n`;
        responseString += `   Nodes: ${workflow.nodes?.length || 0}\n`;
        responseString += `   Owner: ${workflow.owner?.email || 'N/A'}\n\n`;
      });

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error getting workflows: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const getWorkflowsRegistration: ToolRegistration = {
  name: "get_workflows",
  description: "Get all workflows from n8n with optional filtering.",
  category: "n8n",
  operationTypes: ['read'],
  schemaDef: {
    active: { type: 'boolean' as const, optional: true, description: "Filter by active status" },
    tags: { type: 'string' as const, optional: true, description: "Filter by tags" },
    name: { type: 'string' as const, optional: true, description: "Filter by workflow name" },
    projectId: { type: 'string' as const, optional: true, description: "Filter by project ID" },
    excludePinnedData: { type: 'boolean' as const, optional: true, description: "Exclude pinned data" },
    limit: { type: 'number' as const, optional: true, description: "Maximum number of results" },
    cursor: { type: 'string' as const, optional: true, description: "Cursor for pagination" },
  },
  workerClass: GetWorkflowsWorker,
};
