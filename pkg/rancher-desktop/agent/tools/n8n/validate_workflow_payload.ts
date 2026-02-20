import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Validate Workflow Payload Tool - checks create/update payload compatibility with n8n API.
 */
export class ValidateWorkflowPayloadWorker extends BaseTool {
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
      if (!parsedNode.name || !parsedNode.type || !Array.isArray(parsedNode.position)) {
        throw new Error(`Invalid workflow payload: nodes[${index}] must include name, type, and position.`);
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
      const payload = this.normalizeWorkflowPayload(input);

      let n8nReachable = 'not-checked';
      if (input.checkConnection === true) {
        const service = await createN8nService();
        const healthy = await service.healthCheck();
        n8nReachable = healthy ? 'healthy' : 'unhealthy';
      }

      const response = {
        valid: true,
        name: payload.name,
        nodeCount: payload.nodes.length,
        connectionKeys: Object.keys(payload.connections || {}),
        hasSettings: Object.keys(payload.settings || {}).length > 0,
        hasShared: Array.isArray(payload.shared),
        hasStaticData: payload.staticData !== undefined,
        n8nConnection: n8nReachable,
      };

      return {
        successBoolean: true,
        responseString: JSON.stringify(response),
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Workflow payload validation failed: ${(error as Error).message}`,
      };
    }
  }
}

export const validateWorkflowPayloadRegistration: ToolRegistration = {
  name: "validate_workflow_payload",
  description: "Validate an n8n workflow payload (nodes/connections/settings) before create/update.",
  category: "n8n",
  schemaDef: {
    name: { type: 'string' as const, description: "Workflow name" },
    nodes: { type: 'array' as const, items: { type: 'object' as const }, description: "Workflow nodes as n8n node objects." },
    connections: { type: 'object' as const, description: "Workflow connections object keyed by source node name." },
    settings: { type: 'object' as const, optional: true, default: {}, description: "Workflow settings object." },
    shared: { type: 'array' as const, items: { type: 'object' as const }, optional: true, description: "Shared users array." },
    staticData: { type: 'object' as const, optional: true, description: "Workflow staticData object." },
    checkConnection: { type: 'boolean' as const, optional: true, default: true, description: "When true, also checks n8n API health connectivity." },
  },
  workerClass: ValidateWorkflowPayloadWorker,
};
