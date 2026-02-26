import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { getN8nRuntime } from './n8n_runtime';

export class RefreshN8nStateWorker extends BaseTool {
  name = '';
  description = '';
  schemaDef: any = {};

  protected async _validatedCall(): Promise<ToolResponse> {
    try {
      const { stateStore } = await getN8nRuntime();
      await stateStore.refreshCurrentWorkflow();

      return {
        successBoolean: true,
        responseString: 'n8n state refreshed from current workflow endpoint.',
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Failed to refresh n8n state: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

export const refreshN8nStateRegistration: ToolRegistration = {
  name: 'refresh_n8n_state',
  description: 'Refresh the current n8n workflow state in memory.',
  category: 'n8n',
  operationTypes: ['read'],
  schemaDef: {},
  workerClass: RefreshN8nStateWorker,
};
