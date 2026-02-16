import { BaseTool, ToolRegistration } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Get Workflow Tool - Worker class for execution
 */
export class GetWorkflowWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const service = await createN8nService();
    return await service.getWorkflow(input.id, input.excludePinnedData);
  }
}

// Export the complete tool registration with type enforcement
export const getWorkflowRegistration: ToolRegistration = {
  name: "get_workflow",
  description: "Get a specific workflow by ID from n8n.",
  category: "n8n",
  schemaDef: {
    id: { type: 'string' as const, description: "Workflow ID" },
    excludePinnedData: { type: 'boolean' as const, optional: true, description: "Exclude pinned data" },
  },
  workerClass: GetWorkflowWorker,
};
