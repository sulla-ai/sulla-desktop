import { BaseTool, ToolResponse } from '../base';
import { createN8nService } from '../../services/N8nService';

type JsonRecord = Record<string, any>;

type ConnectionEdge = {
  sourceNode: string;
  sourceOutputIndex: number;
  sourceType: string;
  targetNode: string;
  targetInputIndex: number;
  targetType: string;
};

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as JsonRecord;
}

function asEdgeArray(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry)) as JsonRecord[];
}

function collectEdges(connectionsRaw: unknown): {
  edges: ConnectionEdge[];
  brokenConnections: Array<{ sourceNode: string; issue: string; detail?: string }>;
} {
  const edges: ConnectionEdge[] = [];
  const brokenConnections: Array<{ sourceNode: string; issue: string; detail?: string }> = [];
  const connections = asRecord(connectionsRaw);

  for (const [sourceNode, byTypeRaw] of Object.entries(connections)) {
    const byType = asRecord(byTypeRaw);

    for (const [sourceType, outputBucketsRaw] of Object.entries(byType)) {
      const outputBuckets = Array.isArray(outputBucketsRaw)
        ? outputBucketsRaw
        : Object.values(asRecord(outputBucketsRaw));

      outputBuckets.forEach((targetsRaw, sourceOutputIndex) => {
        if (!Array.isArray(targetsRaw)) {
          brokenConnections.push({
            sourceNode,
            issue: 'malformed_output_bucket',
            detail: `Expected array at ${sourceType}[${sourceOutputIndex}]`,
          });
          return;
        }

        const targets = asEdgeArray(targetsRaw);
        for (const target of targets) {
          const targetNode = String(target.node || '').trim();
          if (!targetNode) {
            brokenConnections.push({
              sourceNode,
              issue: 'missing_target_node',
              detail: `Missing target node at ${sourceType}[${sourceOutputIndex}]`,
            });
            continue;
          }

          edges.push({
            sourceNode,
            sourceOutputIndex,
            sourceType: String(sourceType || 'main'),
            targetNode,
            targetInputIndex: Number(target.index ?? 0),
            targetType: String(target.type || 'main'),
          });
        }
      });
    }
  }

  return { edges, brokenConnections };
}

export class ValidateWorkflowWorker extends BaseTool {
  name = '';
  description = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const workflowId = String(input.workflowId || '').trim();
      if (!workflowId) {
        throw new Error('workflowId is required');
      }

      const service = await createN8nService();
      const workflow = await service.getWorkflowWithCredentials(workflowId, true);

      const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes : [];
      const connections = workflow?.connections;
      const credentials = Array.isArray(workflow?.credentials) ? workflow.credentials : [];

      const nodeNames = new Set(
        nodes.map((node: any) => String(node?.name || '').trim()).filter(Boolean)
      );

      const credentialIds = new Set(
        credentials.map((cred: any) => String(cred?.id || '').trim()).filter(Boolean)
      );
      const credentialNames = new Set(
        credentials.map((cred: any) => String(cred?.name || '').trim()).filter(Boolean)
      );

      const { edges, brokenConnections } = collectEdges(connections);

      for (const edge of edges) {
        if (!nodeNames.has(edge.sourceNode)) {
          brokenConnections.push({
            sourceNode: edge.sourceNode,
            issue: 'source_node_missing',
            detail: `Source node ${edge.sourceNode} not found in workflow nodes`,
          });
        }
        if (!nodeNames.has(edge.targetNode)) {
          brokenConnections.push({
            sourceNode: edge.sourceNode,
            issue: 'target_node_missing',
            detail: `Target node ${edge.targetNode} not found`,
          });
        }
      }

      const inboundCount = new Map<string, number>();
      const outboundCount = new Map<string, number>();
      for (const edge of edges) {
        outboundCount.set(edge.sourceNode, (outboundCount.get(edge.sourceNode) || 0) + 1);
        inboundCount.set(edge.targetNode, (inboundCount.get(edge.targetNode) || 0) + 1);
      }

      const floatingNodes = nodes
        .filter((node: any) => {
          const name = String(node?.name || '').trim();
          if (!name) {
            return false;
          }
          return (inboundCount.get(name) || 0) === 0 && (outboundCount.get(name) || 0) === 0;
        })
        .map((node: any) => ({
          id: String(node?.id || '').trim(),
          name: String(node?.name || '').trim(),
          type: String(node?.type || '').trim(),
        }));

      const nodesWithNoTypeConfigured = nodes
        .filter((node: any) => !String(node?.type || '').trim())
        .map((node: any) => ({
          id: String(node?.id || '').trim(),
          name: String(node?.name || '').trim(),
        }));

      const missingCredentials = nodes
        .map((node: any) => {
          const required = asRecord(node?.credentials);
          const missing: string[] = [];

          for (const [credentialType, credentialRefRaw] of Object.entries(required)) {
            const credentialRef = asRecord(credentialRefRaw);
            const id = String(credentialRef.id || '').trim();
            const name = String(credentialRef.name || '').trim();

            if (!id && !name) {
              missing.push(`${credentialType}:missing_reference`);
              continue;
            }

            const idExists = id ? credentialIds.has(id) : false;
            const nameExists = name ? credentialNames.has(name) : false;

            if (!idExists && !nameExists) {
              missing.push(`${credentialType}:${id || name}`);
            }
          }

          if (!missing.length) {
            return null;
          }

          return {
            nodeId: String(node?.id || '').trim(),
            nodeName: String(node?.name || '').trim(),
            nodeType: String(node?.type || '').trim(),
            missing,
          };
        })
        .filter(Boolean);

      const report = {
        workflowId: String(workflow?.id || workflowId),
        workflowName: String(workflow?.name || ''),
        summary: {
          nodeCount: nodes.length,
          edgeCount: edges.length,
          floatingNodeCount: floatingNodes.length,
          missingCredentialNodeCount: missingCredentials.length,
          brokenConnectionCount: brokenConnections.length,
          nodesWithNoTypeCount: nodesWithNoTypeConfigured.length,
        },
        floatingNodes,
        missingCredentials,
        brokenConnections,
        nodesWithNoTypeConfigured,
        valid:
          floatingNodes.length === 0
          && missingCredentials.length === 0
          && brokenConnections.length === 0
          && nodesWithNoTypeConfigured.length === 0,
      };

      return {
        successBoolean: true,
        responseString: JSON.stringify(report, null, 2),
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error validating workflow: ${(error as Error).message}`,
      };
    }
  }
}

