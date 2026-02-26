import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { getN8nRuntime } from './n8n_runtime';

export class GetN8nStateWorker extends BaseTool {
  name = '';
  description = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const { stateStore } = await getN8nRuntime();
      const limit = typeof input.executionLimit === 'number' ? Math.max(1, Math.floor(input.executionLimit)) : 10;

      const currentWorkflow = stateStore.getCurrentWorkflow();
      const stateSummary = {
        currentWorkflowId: stateStore.getCurrentWorkflowId(),
        selectedNodes: stateStore.getSelectedNodes(),
        liveExecution: stateStore.getLiveExecution(),
        executions: stateStore.getLastExecutions(limit),
        currentWorkflow,
      };

      return {
        successBoolean: true,
        responseString: JSON.stringify(stateSummary, null, 2),
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Failed to get n8n state: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

export const getN8nStateRegistration: ToolRegistration = {
  name: 'get_n8n_state',
  description: 'Get the current in-memory n8n state snapshot used by the agent.',
  category: 'n8n',
  operationTypes: ['read'],
  schemaDef: {
    executionLimit: { type: 'number' as const, optional: true, description: 'How many recent executions to include (default 10).' },
  },
  workerClass: GetN8nStateWorker,
};
