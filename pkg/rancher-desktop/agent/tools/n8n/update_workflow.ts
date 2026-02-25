import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Update Workflow Tool - Worker class for execution
 */
export class UpdateWorkflowWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  private normalizeSaveDataSuccessExecution(value: unknown): 'none' | 'all' {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'none' ? 'none' : 'all';
  }

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

  private sanitizeShared(shared: any[] | undefined): any[] | undefined {
    if (!Array.isArray(shared)) {
      return undefined;
    }

    return shared.map((entry: any) => {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        return entry;
      }

      const cloned = { ...entry } as any;
      if (cloned.project && typeof cloned.project === 'object' && !Array.isArray(cloned.project)) {
        const { id: _projectId, ...projectWithoutId } = cloned.project;
        cloned.project = projectWithoutId;
      }

      return cloned;
    });
  }

  private async normalizeWorkflowPayload(input: any, service: any): Promise<{ id: string; workflowData: any }> {
    const payload = { ...input };
    const id = String(payload.id || '').trim();

    if (!id) {
      throw new Error('Workflow ID is required');
    }

    const existingWorkflow = await service.getWorkflow(id);

    const name = payload.name ?? existingWorkflow?.name;
    const active = payload.active ?? existingWorkflow?.active;
    const nodes = payload.nodes === undefined
      ? existingWorkflow?.nodes
      : this.parseJsonIfString(payload.nodes, 'nodes');
    const connections = payload.connections === undefined
      ? existingWorkflow?.connections
      : this.parseJsonIfString(payload.connections, 'connections');
    const settings = payload.settings === undefined
      ? (existingWorkflow?.settings || {})
      : (this.parseJsonIfString(payload.settings, 'settings') || {});
    const shared = payload.shared === undefined
      ? undefined
      : this.parseJsonIfString(payload.shared, 'shared');
    const staticData = payload.staticData === undefined
      ? existingWorkflow?.staticData
      : this.parseJsonIfString(payload.staticData, 'staticData');

    if (!name || typeof name !== 'string') {
      throw new Error('Invalid workflow payload: name is required.');
    }

    if (!Array.isArray(nodes)) {
      throw new Error('Invalid workflow payload: nodes must be an array.');
    }

    const normalizedNodes = nodes.map((node: any, index: number) => {
      const parsedNode = this.parseJsonIfString(node, `nodes[${index}]`);
      if (typeof parsedNode !== 'object' || parsedNode === null || Array.isArray(parsedNode)) {
        throw new Error(`Invalid workflow payload: nodes[${index}] must be an object.`);
      }
      return parsedNode;
    });

    if (typeof connections !== 'object' || connections === null || Array.isArray(connections)) {
      throw new Error('Invalid workflow payload: connections must be an object.');
    }

    if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
      throw new Error('Invalid workflow payload: settings must be an object.');
    }

    if ((settings as any).saveDataSuccessExecution !== undefined) {
      (settings as any).saveDataSuccessExecution = this.normalizeSaveDataSuccessExecution((settings as any).saveDataSuccessExecution);
    }

    if (shared !== undefined && !Array.isArray(shared)) {
      throw new Error('Invalid workflow payload: shared must be an array when provided.');
    }

    const sanitizedShared = this.sanitizeShared(shared);

    const workflowData: any = {
      name,
      nodes: normalizedNodes,
      connections,
      settings,
    };

    if (active !== undefined) {
      workflowData.active = active;
    }
    if (sanitizedShared !== undefined) {
      workflowData.shared = sanitizedShared;
    }
    if (staticData !== undefined) {
      workflowData.staticData = staticData;
    }

    return { id, workflowData };
  }

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const { id, workflowData } = await this.normalizeWorkflowPayload(input, service);
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
  operationTypes: ['update'],
  schemaDef: {
    id: { type: 'string' as const, description: "Workflow ID" },
    name: { type: 'string' as const, optional: true, description: "Workflow name (defaults to existing workflow name if omitted)" },
    active: { type: 'boolean' as const, optional: true, description: "Set workflow active state on update" },
    nodes: { type: 'array' as const, items: { type: 'object' as const }, optional: true, description: "Workflow nodes as n8n node objects. Defaults to existing workflow nodes if omitted." },
    connections: { type: 'object' as const, optional: true, description: "Workflow connections object keyed by source node name. Defaults to existing connections if omitted." },
    settings: { type: 'object' as const, properties: {
      saveExecutionProgress: { type: 'boolean' as const, optional: true },
      saveManualExecutions: { type: 'boolean' as const, optional: true },
      saveDataErrorExecution: { type: 'string' as const, optional: true },
      saveDataSuccessExecution: { type: 'enum' as const, enum: ['none', 'all'], optional: true },
      executionTimeout: { type: 'number' as const, optional: true },
      errorWorkflow: { type: 'string' as const, optional: true },
      timezone: { type: 'string' as const, optional: true },
      executionOrder: { type: 'string' as const, optional: true },
      callerPolicy: { type: 'string' as const, optional: true },
      callerIds: { type: 'string' as const, optional: true },
      timeSavedPerExecution: { type: 'number' as const, optional: true },
      availableInMCP: { type: 'boolean' as const, optional: true },
    }, optional: true, description: "Workflow settings (defaults to existing workflow settings if omitted)" },
    shared: { type: 'array' as const, items: { type: 'object' as const }, optional: true, description: "Shared users" },
    staticData: { type: 'object' as const, optional: true, description: "Static data" },
  },
  workerClass: UpdateWorkflowWorker,
};
