import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { getN8nRuntime } from './n8n_runtime';

export class GetN8nWorkflowBridgeWorker extends BaseTool {
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

      const workflow = await bridge.getWorkflow(workflowId);

      return {
        successBoolean: true,
        responseString: JSON.stringify(workflow, null, 2),
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Failed to get workflow via N8nBridgeService: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

export const getN8nWorkflowBridgeRegistration: ToolRegistration = {
  name: 'get_n8n_workflow_bridge',
  description: 'Get a workflow using N8nBridgeService (REST + auth token handling).',
  category: 'n8n',
  operationTypes: ['read'],
  schemaDef: {
    workflowId: { type: 'string' as const, description: 'Workflow ID.' },
  },
  workerClass: GetN8nWorkflowBridgeWorker,
};
