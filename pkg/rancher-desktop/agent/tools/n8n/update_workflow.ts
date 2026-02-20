import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Update Workflow Tool - Worker class for execution
 */
export class UpdateWorkflowWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  private parseJsonIfString(value: any, field: string): any {
    if (typeof value !== 'string') {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      throw new Error(`Invalid JSON for ${field}: ${(error as Error).message}`);
    }
  }

  private normalizeWorkflowPayload(input: any): { id: string; workflowData: any } {
    const payload = { ...input };

    payload.nodes = this.parseJsonIfString(payload.nodes, 'nodes');
    payload.connections = this.parseJsonIfString(payload.connections, 'connections');
    payload.settings = this.parseJsonIfString(payload.settings, 'settings') || {};
    payload.shared = this.parseJsonIfString(payload.shared, 'shared');
    payload.staticData = this.parseJsonIfString(payload.staticData, 'staticData');

    if (!Array.isArray(payload.nodes)) {
      throw new Error('Invalid workflow payload: nodes must be an array.');
    }

    payload.nodes = payload.nodes.map((node: any, index: number) => {
      const parsedNode = this.parseJsonIfString(node, `nodes[${index}]`);
      if (typeof parsedNode !== 'object' || parsedNode === null || Array.isArray(parsedNode)) {
        throw new Error(`Invalid workflow payload: nodes[${index}] must be an object.`);
      }
      return parsedNode;
    });

    if (typeof payload.connections !== 'object' || payload.connections === null || Array.isArray(payload.connections)) {
      throw new Error('Invalid workflow payload: connections must be an object.');
    }

    if (typeof payload.settings !== 'object' || payload.settings === null || Array.isArray(payload.settings)) {
      throw new Error('Invalid workflow payload: settings must be an object.');
    }

    if (payload.shared !== undefined && !Array.isArray(payload.shared)) {
      throw new Error('Invalid workflow payload: shared must be an array when provided.');
    }

    const { id, ...workflowData } = payload;
    return { id, workflowData };
  }

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const { id, workflowData } = this.normalizeWorkflowPayload(input);
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
    nodes: { type: 'array' as const, items: { type: 'object' as const }, description: "Workflow nodes as n8n node objects." },
    connections: { type: 'object' as const, description: "Workflow connections object keyed by source node name." },
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
    }, optional: true, default: {}, description: "Workflow settings" },
    shared: { type: 'array' as const, items: { type: 'object' as const }, optional: true, description: "Shared users" },
    staticData: { type: 'object' as const, optional: true, description: "Static data" },
  },
  workerClass: UpdateWorkflowWorker,
};
