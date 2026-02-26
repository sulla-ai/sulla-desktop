import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { getN8nRuntime } from './n8n_runtime';

export class RunN8nWorkflowBridgeWorker extends BaseTool {
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

      const data = input.data && typeof input.data === 'object' && !Array.isArray(input.data)
        ? input.data
        : {};

      const result = await bridge.runWorkflow(workflowId, data);

      return {
        successBoolean: true,
        responseString: JSON.stringify(result, null, 2),
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Failed to run workflow via N8nBridgeService: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

export const runN8nWorkflowBridgeRegistration: ToolRegistration = {
  name: 'run_n8n_workflow_bridge',
  description: 'Run a workflow using N8nBridgeService.',
  category: 'n8n',
  operationTypes: ['execute'],
  schemaDef: {
    workflowId: { type: 'string' as const, description: 'Workflow ID.' },
    data: { type: 'object' as const, optional: true, description: 'Optional run payload.' },
  },
  workerClass: RunN8nWorkflowBridgeWorker,
};
