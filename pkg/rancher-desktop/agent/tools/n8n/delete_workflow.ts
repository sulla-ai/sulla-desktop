import { BaseTool, ToolRegistration } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Delete Workflow Tool - Worker class for execution
 */
export class DeleteWorkflowWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const service = await createN8nService();
    return await service.deleteWorkflow(input.id);
  }
}

// Export the complete tool registration with type enforcement
export const deleteWorkflowRegistration: ToolRegistration = {
  name: "delete_workflow",
  description: "Delete a workflow from n8n.",
  category: "n8n",
  schemaDef: {
    id: { type: 'string' as const, description: "Workflow ID" },
  },
  workerClass: DeleteWorkflowWorker,
};
