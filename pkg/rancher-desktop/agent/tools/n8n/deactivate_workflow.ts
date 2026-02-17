import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Deactivate Workflow Tool - Worker class for execution
 */
export class DeactivateWorkflowWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const result = await service.deactivateWorkflow(input.id);

      const responseString = `Workflow deactivated successfully:
ID: ${input.id}
Deactivation completed at: ${new Date().toLocaleString()}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error deactivating workflow: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const deactivateWorkflowRegistration: ToolRegistration = {
  name: "deactivate_workflow",
  description: "Deactivate a workflow in n8n.",
  category: "n8n",
  schemaDef: {
    id: { type: 'string' as const, description: "Workflow ID" },
  },
  workerClass: DeactivateWorkflowWorker,
};
