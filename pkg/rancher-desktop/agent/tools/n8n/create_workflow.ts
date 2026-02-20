import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Create Workflow Tool - Worker class for execution
 */
export class CreateWorkflowWorker extends BaseTool {
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

  private normalizeWorkflowPayload(input: any): any {
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

    return payload;
  }

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const payload = this.normalizeWorkflowPayload(input);
      const workflow = await service.createWorkflow(payload);

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
  workerClass: CreateWorkflowWorker,
};
