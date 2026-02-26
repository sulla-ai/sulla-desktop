import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { createN8nService } from '../../services/N8nService';

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export class CloneWorkflowWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const workflowId = String(input.workflowId || '').trim();
      const newName = String(input.newName || '').trim();

      if (!workflowId) {
        throw new Error('workflowId is required.');
      }
      if (!newName) {
        throw new Error('newName is required.');
      }

      const service = await createN8nService();
      const source = await service.getWorkflow(workflowId, true);

      const payload = {
        name: newName,
        nodes: Array.isArray(source?.nodes) ? deepClone(source.nodes) : [],
        connections: source?.connections && typeof source.connections === 'object' && !Array.isArray(source.connections)
          ? deepClone(source.connections)
          : {},
        settings: source?.settings && typeof source.settings === 'object' && !Array.isArray(source.settings)
          ? deepClone(source.settings)
          : {},
        ...(source?.staticData !== undefined ? { staticData: deepClone(source.staticData) } : {}),
      };

      const cloned = await service.createWorkflow(payload as any);

      return {
        successBoolean: true,
        responseString: JSON.stringify({
          sourceWorkflowId: workflowId,
          sourceWorkflowName: String(source?.name || ''),
          clonedWorkflowId: String(cloned?.id || ''),
          clonedWorkflowName: String(cloned?.name || newName),
          active: !!cloned?.active,
          nodeCount: Array.isArray(cloned?.nodes) ? cloned.nodes.length : payload.nodes.length,
        }, null, 2),
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error cloning workflow: ${(error as Error).message}`,
      };
    }
  }
}

export const cloneWorkflowRegistration: ToolRegistration = {
  name: 'clone_workflow',
  description: 'Clone an existing n8n workflow into a new workflow name for safe experimentation.',
  category: 'n8n',
  operationTypes: ['read', 'create'],
  schemaDef: {
    workflowId: { type: 'string' as const, description: 'Source workflow ID to clone.' },
    newName: { type: 'string' as const, description: 'Name for the cloned workflow.' },
  },
  workerClass: CloneWorkflowWorker,
};
