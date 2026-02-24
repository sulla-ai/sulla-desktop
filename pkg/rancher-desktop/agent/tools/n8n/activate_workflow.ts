import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Activate Workflow Tool - Worker class for execution
 */
export class ActivateWorkflowWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  private normalizeActivationOptions(input: any): { versionId?: string } | undefined {
    const rawVersionId = input?.versionId;
    if (rawVersionId === undefined || rawVersionId === null) {
      return undefined;
    }

    const versionId = String(rawVersionId).trim();
    return versionId ? { versionId } : undefined;
  }

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const result = await service.activateWorkflow(input.id, this.normalizeActivationOptions(input));

      const responseString = `Workflow activated successfully:
ID: ${input.id}
Activation ID: ${result.id}
Name: ${result.name || 'N/A'}
Description: ${result.description || 'N/A'}
Created: ${new Date(result.createdAt).toLocaleString()}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error activating workflow: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const activateWorkflowRegistration: ToolRegistration = {
  name: "activate_workflow",
  description: "Activate a workflow in n8n.",
  category: "n8n",
  operationTypes: ['update','create'],
  schemaDef: {
    id: { type: 'string' as const, description: "Workflow ID" },
    versionId: { type: 'string' as const, optional: true, description: "Version ID to activate" },
  },
  workerClass: ActivateWorkflowWorker,
};
