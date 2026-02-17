import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Delete Workflow Tool - Worker class for execution
 */
export class DeleteWorkflowWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const result = await service.deleteWorkflow(input.id);

      const responseString = `Workflow deleted successfully:
ID: ${input.id}
Deletion completed at: ${new Date().toLocaleString()}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error deleting workflow: ${(error as Error).message}`
      };
    }
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
