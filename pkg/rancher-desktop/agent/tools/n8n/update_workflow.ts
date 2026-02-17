import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Update Workflow Tool - Worker class for execution
 */
export class UpdateWorkflowWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();

      // Parse nodes from JSON strings to objects if needed
      if (Array.isArray(input.nodes)) {
        input.nodes = input.nodes.map((node: any) => {
          if (typeof node === 'string') {
            return JSON.parse(node);
          }
          return node;
        });
      }

      // Parse connections from JSON string to object if needed
      if (typeof input.connections === 'string') {
        input.connections = JSON.parse(input.connections);
      }

      // Parse staticData from JSON string to object if needed
      if (typeof input.staticData === 'string') {
        input.staticData = JSON.parse(input.staticData);
      }

      const { id, ...workflowData } = input;
      const workflow = await service.updateWorkflow(id, workflowData);

      const responseString = `Workflow updated successfully:
ID: ${workflow.id}
Name: ${workflow.name}
Active: ${workflow.active ? 'Yes' : 'No'}
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
        responseString: `Error updating workflow: ${(error as Error).message}`
      };
    }
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
