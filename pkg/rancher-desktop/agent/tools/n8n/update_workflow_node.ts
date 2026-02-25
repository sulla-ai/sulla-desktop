import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { createN8nService } from '../../services/N8nService';
import {
  cloneWorkflowGraph,
  ensureUniqueNodeName,
  rewriteConnectionsForNodeRename,
  resolveNodeIndex,
} from './workflow_node_utils';

export class UpdateWorkflowNodeWorker extends BaseTool {
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

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const workflow = await service.getWorkflow(input.workflowId, true);
      const graph = cloneWorkflowGraph(workflow);

      const nodeIndex = resolveNodeIndex(graph.nodes, {
        nodeId: input.nodeId,
        nodeName: input.nodeName,
      });

      const existingNode = graph.nodes[nodeIndex];
      const oldName = String(existingNode?.name || '');

      const patch = this.parseJsonIfString(input.nodePatch, 'nodePatch');
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        throw new Error('nodePatch must be an object.');
      }

      const mergedNode = {
        ...existingNode,
        ...patch,
      };

      if (patch.name !== undefined) {
        mergedNode.name = ensureUniqueNodeName(String(patch.name), graph.nodes, String(existingNode.id || ''));
      }

      graph.nodes[nodeIndex] = mergedNode;

      const newName = String(mergedNode.name || '');
      if (oldName && newName && oldName !== newName) {
        graph.connections = rewriteConnectionsForNodeRename(graph.connections, oldName, newName);
      }

      const updated = await service.updateWorkflow(workflow.id, {
        name: graph.name,
        nodes: graph.nodes,
        connections: graph.connections,
        settings: graph.settings,
        staticData: graph.staticData,
      });

      return {
        successBoolean: true,
        responseString: JSON.stringify({
          workflowId: updated.id,
          nodeIndex,
          previousNodeName: oldName,
          updatedNodeName: mergedNode.name,
          updatedNodeId: mergedNode.id,
        }, null, 2),
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error updating workflow node: ${(error as Error).message}`,
      };
    }
  }
}

export const updateWorkflowNodeRegistration: ToolRegistration = {
  name: 'update_workflow_node',
  description: 'Update a single node in an n8n workflow by nodeId or nodeName.',
  category: 'n8n',
  operationTypes: ['update'],
  schemaDef: {
    workflowId: { type: 'string' as const, description: 'Workflow ID' },
    nodePatch: { type: 'object' as const, description: 'Partial node fields to update.' },
    nodeId: { type: 'string' as const, optional: true, description: 'Node ID (preferred)' },
    nodeName: { type: 'string' as const, optional: true, description: 'Node name (must be unique if used)' },
  },
  workerClass: UpdateWorkflowNodeWorker,
};
