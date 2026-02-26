import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { createN8nService } from '../../services/N8nService';
import { cloneWorkflowGraph } from './workflow_node_utils';

type JsonRecord = Record<string, any>;

function ensureRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as JsonRecord;
}

export class AddWorkflowConnectionWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const workflowId = String(input.workflowId || '').trim();
      const sourceNodeName = String(input.sourceNodeName || '').trim();
      const targetNodeName = String(input.targetNodeName || '').trim();
      const sourceIndex = Number(input.sourceIndex ?? 0);
      const targetIndex = Number(input.targetIndex ?? 0);
      const sourceType = String(input.sourceType || 'main').trim() || 'main';
      const targetType = String(input.targetType || 'main').trim() || 'main';

      if (!workflowId) {
        throw new Error('workflowId is required.');
      }
      if (!sourceNodeName) {
        throw new Error('sourceNodeName is required.');
      }
      if (!targetNodeName) {
        throw new Error('targetNodeName is required.');
      }
      if (!Number.isInteger(sourceIndex) || sourceIndex < 0) {
        throw new Error('sourceIndex must be a non-negative integer.');
      }
      if (!Number.isInteger(targetIndex) || targetIndex < 0) {
        throw new Error('targetIndex must be a non-negative integer.');
      }

      const service = await createN8nService();
      const workflow = await service.getWorkflow(workflowId, true);
      const graph = cloneWorkflowGraph(workflow);

      const nodeNames = new Set(
        (Array.isArray(graph.nodes) ? graph.nodes : [])
          .map((node) => String(node?.name || '').trim())
          .filter(Boolean)
      );

      if (!nodeNames.has(sourceNodeName)) {
        throw new Error(`Source node not found: ${sourceNodeName}`);
      }
      if (!nodeNames.has(targetNodeName)) {
        throw new Error(`Target node not found: ${targetNodeName}`);
      }

      const connections = ensureRecord(graph.connections);
      graph.connections = connections;

      const sourceNodeMap = ensureRecord(connections[sourceNodeName]);
      connections[sourceNodeName] = sourceNodeMap;

      const typeBucketsRaw = sourceNodeMap[sourceType];
      const typeBuckets: any[] = Array.isArray(typeBucketsRaw) ? typeBucketsRaw : [];
      sourceNodeMap[sourceType] = typeBuckets;

      while (typeBuckets.length <= sourceIndex) {
        typeBuckets.push([]);
      }

      const outputEdgesRaw = typeBuckets[sourceIndex];
      const outputEdges: any[] = Array.isArray(outputEdgesRaw) ? outputEdgesRaw : [];
      typeBuckets[sourceIndex] = outputEdges;

      const alreadyExists = outputEdges.some((edge) =>
        String(edge?.node || '').trim() === targetNodeName &&
        String(edge?.type || '').trim() === targetType &&
        Number(edge?.index ?? -1) === targetIndex
      );

      if (!alreadyExists) {
        outputEdges.push({
          node: targetNodeName,
          type: targetType,
          index: targetIndex,
        });
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
          sourceNodeName,
          sourceType,
          sourceIndex,
          targetNodeName,
          targetType,
          targetIndex,
          created: !alreadyExists,
        }, null, 2),
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error adding workflow connection: ${(error as Error).message}`,
      };
    }
  }
}

export const addWorkflowConnectionRegistration: ToolRegistration = {
  name: 'add_workflow_connection',
  description: 'Add a single connection edge to an n8n workflow without rebuilding the whole connections object.',
  category: 'n8n',
  operationTypes: ['update'],
  schemaDef: {
    workflowId: { type: 'string' as const, description: 'Workflow ID' },
    sourceNodeName: { type: 'string' as const, description: 'Source node name.' },
    targetNodeName: { type: 'string' as const, description: 'Target node name.' },
    sourceIndex: { type: 'number' as const, optional: true, default: 0, description: 'Source output index.' },
    targetIndex: { type: 'number' as const, optional: true, default: 0, description: 'Target input index.' },
    sourceType: { type: 'string' as const, optional: true, default: 'main', description: 'Source connection type (usually main).' },
    targetType: { type: 'string' as const, optional: true, default: 'main', description: 'Target connection type (usually main).' },
  },
  workerClass: AddWorkflowConnectionWorker,
};
