import { BaseTool, ToolRegistration } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Get Workflows Tool - Worker class for execution
 */
export class GetWorkflowsWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const service = await createN8nService();
    return await service.getWorkflows(input);
  }
}

// Export the complete tool registration with type enforcement
export const getWorkflowsRegistration: ToolRegistration = {
  name: "get_workflows",
  description: "Get all workflows from n8n with optional filtering.",
  category: "n8n",
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
