import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { createN8nService } from '../../services/N8nService';

export class SetWorkflowActiveWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const workflowId = String(input.workflowId || '').trim();
      if (!workflowId) {
        throw new Error('workflowId is required.');
      }

      const active = input.active === true;
      const service = await createN8nService();

      let result: any;
      if (active) {
        const versionId = typeof input.versionId === 'string' && input.versionId.trim()
          ? input.versionId.trim()
          : undefined;
        result = await service.activateWorkflow(workflowId, versionId ? { versionId } : undefined);
      } else {
        result = await service.deactivateWorkflow(workflowId);
      }

      return {
        successBoolean: true,
        responseString: JSON.stringify({
          workflowId,
          active,
          result: result ?? null,
          toggledAt: new Date().toISOString(),
        }, null, 2),
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error toggling workflow active state: ${(error as Error).message}`,
      };
    }
  }
}

export const setWorkflowActiveRegistration: ToolRegistration = {
  name: 'set_workflow_active',
  description: 'Toggle a workflow active state on/off without doing a full workflow update.',
  category: 'n8n',
  operationTypes: ['update'],
  schemaDef: {
    workflowId: { type: 'string' as const, description: 'Workflow ID' },
    active: { type: 'boolean' as const, description: 'true to activate, false to deactivate' },
    versionId: { type: 'string' as const, optional: true, description: 'Optional version ID when activating.' },
  },
  workerClass: SetWorkflowActiveWorker,
};
