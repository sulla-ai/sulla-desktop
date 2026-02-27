import { BaseTool, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Create Workflow Tool - Worker class for execution
 */
export class CreateWorkflowWorker extends BaseTool {
  name: string = '';
  description: string = '';

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

    if (payload.settings.saveDataSuccessExecution !== undefined) {
      payload.settings.saveDataSuccessExecution = this.normalizeSaveDataSuccessExecution(payload.settings.saveDataSuccessExecution);
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
