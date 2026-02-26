import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { getN8nRuntime } from './n8n_runtime';

export class UpdateN8nWorkflowBridgeWorker extends BaseTool {
  name = '';
  description = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const { bridge } = await getN8nRuntime();
      const workflowId = String(input.workflowId || '').trim();
      if (!workflowId) {
        return { successBoolean: false, responseString: 'workflowId is required' };
      }

      const workflow = input.workflow;
      if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
        return { successBoolean: false, responseString: 'workflow must be an object' };
      }

      const result = await bridge.updateWorkflow(workflowId, workflow);

      return {
        successBoolean: true,
        responseString: JSON.stringify(result, null, 2),
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Failed to update workflow via N8nBridgeService: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

export const updateN8nWorkflowBridgeRegistration: ToolRegistration = {
  name: 'update_n8n_workflow_bridge',
  description: 'Update a workflow using N8nBridgeService.',
  category: 'n8n',
  operationTypes: ['update'],
  schemaDef: {
    workflowId: { type: 'string' as const, description: 'Workflow ID.' },
    workflow: { type: 'object' as const, description: 'Full workflow payload.' },
  },
  workerClass: UpdateN8nWorkflowBridgeWorker,
};
