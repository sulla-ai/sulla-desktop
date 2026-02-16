import { BaseTool, ToolRegistration } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Activate Workflow Tool - Worker class for execution
 */
export class ActivateWorkflowWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const service = await createN8nService();
    return await service.activateWorkflow(input.id, input);
  }
}

// Export the complete tool registration with type enforcement
export const activateWorkflowRegistration: ToolRegistration = {
  name: "activate_workflow",
  description: "Activate a workflow in n8n.",
  category: "n8n",
  schemaDef: {
    id: { type: 'string' as const, description: "Workflow ID" },
    versionId: { type: 'string' as const, optional: true, description: "Version ID to activate" },
    name: { type: 'string' as const, optional: true, description: "Activation name" },
    description: { type: 'string' as const, optional: true, description: "Activation description" },
  },
  workerClass: ActivateWorkflowWorker,
};
