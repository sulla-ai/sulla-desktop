import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Get Workflow Tool - Worker class for execution
 */
export class GetWorkflowWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const workflow = await service.getWorkflowWithCredentials(input.id, input.excludePinnedData);

      const responseString = JSON.stringify(workflow, null, 2);

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error getting workflow: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const getWorkflowRegistration: ToolRegistration = {
  name: "get_workflow",
  description: "Get a specific workflow by ID from n8n.",
  category: "n8n",
  operationTypes: ['read'],
  schemaDef: {
    id: { type: 'string' as const, description: "Workflow ID" },
    excludePinnedData: { type: 'boolean' as const, optional: true, description: "Exclude pinned data" },
  },
  workerClass: GetWorkflowWorker,
};
