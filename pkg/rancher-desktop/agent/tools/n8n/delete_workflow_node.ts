import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { createN8nService } from '../../services/N8nService';
import {
  cloneWorkflowGraph,
  countNodeConnections,
  removeNodeFromConnections,
  resolveNodeIndex,
} from './workflow_node_utils';

export class DeleteWorkflowNodeWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const workflowId = String(input.workflowId || '').trim();
      const nodeName = String(input.nodeName || '').trim();

      if (!workflowId) {
        throw new Error('workflowId is required.');
      }
      if (!nodeName) {
        throw new Error('nodeName is required.');
      }

      const service = await createN8nService();
      const workflow = await service.getWorkflow(workflowId, true);
      const graph = cloneWorkflowGraph(workflow);

      const nodeIndex = resolveNodeIndex(graph.nodes, { nodeName });
      const [removedNode] = graph.nodes.splice(nodeIndex, 1);
      const removedName = String(removedNode?.name || nodeName);

      const removedConnectionSummary = countNodeConnections(graph.connections || {}, removedName);
      graph.connections = removeNodeFromConnections(graph.connections, removedName);

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
          removedNodeId: removedNode?.id,
          removedNodeName: removedName,
          removedNodeIndex: nodeIndex,
          removedConnections: removedConnectionSummary,
          remainingNodeCount: graph.nodes.length,
        }, null, 2),
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error deleting workflow node: ${(error as Error).message}`,
      };
    }
  }
}

export const deleteWorkflowNodeRegistration: ToolRegistration = {
  name: 'delete_workflow_node',
  description: 'Delete a node by nodeName from an n8n workflow and auto-clean orphaned connections referencing that node.',
  category: 'n8n',
  operationTypes: ['delete', 'update'],
  schemaDef: {
    workflowId: { type: 'string' as const, description: 'Workflow ID' },
    nodeName: { type: 'string' as const, description: 'Node name to remove (must be unique).' },
  },
  workerClass: DeleteWorkflowNodeWorker,
};
