import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { createN8nService } from '../../services/N8nService';
import {
  cloneWorkflowGraph,
  countNodeConnections,
  removeNodeFromConnections,
  resolveNodeIndex,
} from './workflow_node_utils';

export class RemoveWorkflowNodeWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const workflow = await service.getWorkflow(input.workflowId, true);
      const graph = cloneWorkflowGraph(workflow);

      const nodeIndex = resolveNodeIndex(graph.nodes, {
        nodeId: input.nodeId,
        nodeName: input.nodeName,
      });

      const [removedNode] = graph.nodes.splice(nodeIndex, 1);
      const removedName = String(removedNode?.name || '');
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
        responseString: `Error removing workflow node: ${(error as Error).message}`,
      };
    }
  }
}

export const removeWorkflowNodeRegistration: ToolRegistration = {
  name: 'remove_workflow_node',
  description: 'Remove a single node from an n8n workflow and clean related connections.',
  category: 'n8n',
  schemaDef: {
    workflowId: { type: 'string' as const, description: 'Workflow ID' },
    nodeId: { type: 'string' as const, optional: true, description: 'Node ID (preferred)' },
    nodeName: { type: 'string' as const, optional: true, description: 'Node name (must be unique if used)' },
  },
  workerClass: RemoveWorkflowNodeWorker,
};
