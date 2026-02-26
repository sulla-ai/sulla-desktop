import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { getN8nRuntime } from './n8n_runtime';

export class WaitN8nExecutionCompleteWorker extends BaseTool {
  name = '';
  description = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const { stateStore } = await getN8nRuntime();
      const executionId = String(input.executionId || '').trim();
      if (!executionId) {
        return { successBoolean: false, responseString: 'executionId is required' };
      }

      const timeoutMs = typeof input.timeoutMs === 'number' ? Math.max(1000, Math.floor(input.timeoutMs)) : 30000;
      const result = await stateStore.waitForExecutionComplete(executionId, timeoutMs);

      return {
        successBoolean: true,
        responseString: JSON.stringify(result, null, 2),
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Failed waiting for execution completion: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

export const waitN8nExecutionCompleteRegistration: ToolRegistration = {
  name: 'wait_n8n_execution_complete',
  description: 'Wait until a specific n8n execution completes using live state.',
  category: 'n8n',
  operationTypes: ['read'],
  schemaDef: {
    executionId: { type: 'string' as const, description: 'Execution ID to wait for.' },
    timeoutMs: { type: 'number' as const, optional: true, description: 'Timeout in milliseconds (default 30000).' },
  },
  workerClass: WaitN8nExecutionCompleteWorker,
};
