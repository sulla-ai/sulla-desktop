import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Create Workflow Tool - Worker class for execution
 */
export class CreateWorkflowWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const workflow = await service.createWorkflow(input);

      const responseString = `Workflow created successfully:
ID: ${workflow.id}
Name: ${workflow.name}
Active: ${workflow.active ? 'Yes' : 'No'}
Created: ${new Date(workflow.createdAt).toLocaleString()}
Updated: ${new Date(workflow.updatedAt).toLocaleString()}
Nodes: ${workflow.nodes?.length || 0}
Connections: ${Object.keys(workflow.connections || {}).length}
Tags: ${(workflow.tags || []).map((tag: any) => tag.name).join(', ') || 'None'}
Owner: ${workflow.owner?.email || 'N/A'}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error creating workflow: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const createWorkflowRegistration: ToolRegistration = {
  name: "create_workflow",
  description: "Create a new workflow in n8n.",
  category: "n8n",
  schemaDef: {
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
  workerClass: CreateWorkflowWorker,
};
