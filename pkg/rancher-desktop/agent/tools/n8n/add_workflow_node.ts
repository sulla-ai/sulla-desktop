import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { createN8nService } from '../../services/N8nService';
import {
  cloneWorkflowGraph,
  computeInsertIndex,
  ensureNodeId,
  ensureUniqueNodeName,
  resolveNodeIndex,
} from './workflow_node_utils';

export class AddWorkflowNodeWorker extends BaseTool {
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
      const mode = (input.insertMode || 'append') as 'append' | 'before' | 'after';
      const rawNode = this.parseJsonIfString(input.node, 'node');

      if (!rawNode || typeof rawNode !== 'object' || Array.isArray(rawNode)) {
        throw new Error('node must be an object.');
      }

      if (!rawNode.type || !Array.isArray(rawNode.position)) {
        throw new Error('node must include at least type and position fields.');
      }

      const anchorIndex = mode === 'append'
        ? undefined
        : resolveNodeIndex(graph.nodes, { nodeId: input.anchorNodeId, nodeName: input.anchorNodeName });

      const nodeName = ensureUniqueNodeName(rawNode.name || 'New Node', graph.nodes);
      const nodeId = ensureNodeId(rawNode.id, nodeName, graph.nodes);

      const nodeToInsert = {
        ...rawNode,
        id: nodeId,
        name: nodeName,
      };

      const insertIndex = computeInsertIndex(graph.nodes.length, mode, anchorIndex);
      graph.nodes.splice(insertIndex, 0, nodeToInsert);

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
          insertedNodeId: nodeToInsert.id,
          insertedNodeName: nodeToInsert.name,
          insertIndex,
          insertMode: mode,
          nodeCount: graph.nodes.length,
        }, null, 2),
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error adding workflow node: ${(error as Error).message}`,
      };
    }
  }
}

export const addWorkflowNodeRegistration: ToolRegistration = {
  name: 'add_workflow_node',
  description: 'Add a single node to an existing n8n workflow with deterministic placement.',
  category: 'n8n',
  operationTypes: ['create','update'],
  schemaDef: {
    workflowId: { type: 'string' as const, description: 'Workflow ID' },
    node: { type: 'object' as const, description: 'The n8n node object to add.' },
    insertMode: {
      type: 'enum' as const,
      enum: ['append', 'before', 'after'],
      optional: true,
      default: 'append',
      description: 'Insert mode for placement. before/after require anchor node selector.',
    },
    anchorNodeId: { type: 'string' as const, optional: true, description: 'Anchor node ID for before/after insert modes.' },
    anchorNodeName: { type: 'string' as const, optional: true, description: 'Anchor node name for before/after insert modes.' },
  },
  workerClass: AddWorkflowNodeWorker,
};
