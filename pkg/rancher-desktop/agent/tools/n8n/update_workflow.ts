import { BaseTool, ToolRegistration } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Update Workflow Tool - Worker class for execution
 */
export class UpdateWorkflowWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const service = await createN8nService();
    const { id, ...workflowData } = input;
    return await service.updateWorkflow(id, workflowData);
  }
}

// Export the complete tool registration with type enforcement
export const updateWorkflowRegistration: ToolRegistration = {
  name: "update_workflow",
  description: "Update an existing workflow in n8n.",
  category: "n8n",
  schemaDef: {
    id: { type: 'string' as const, description: "Workflow ID" },
    name: { type: 'string' as const, description: "Workflow name" },
    nodes: { type: 'array' as const, items: { type: 'string' as const }, description: "Workflow nodes" },
    connections: { type: 'string' as const, description: "Workflow connections" },
    settings: { type: 'object' as const, properties: {
      saveExecutionProgress: { type: 'boolean' as const, optional: true },
      saveManualExecutions: { type: 'boolean' as const, optional: true },
      saveDataErrorExecution: { type: 'string' as const, optional: true },
      saveDataSuccessExecution: { type: 'string' as const, optional: true },
      executionTimeout: { type: 'number' as const, optional: true },
      errorWorkflow: { type: 'string' as const, optional: true },
      timezone: { type: 'string' as const, optional: true },
      executionOrder: { type: 'string' as const, optional: true },
      callerPolicy: { type: 'string' as const, optional: true },
      callerIds: { type: 'string' as const, optional: true },
      timeSavedPerExecution: { type: 'number' as const, optional: true },
      availableInMCP: { type: 'boolean' as const, optional: true },
    }, description: "Workflow settings" },
    shared: { type: 'array' as const, items: { type: 'string' as const }, optional: true, description: "Shared users" },
    staticData: { type: 'string' as const, optional: true, description: "Static data" },
  },
  workerClass: UpdateWorkflowWorker,
};
