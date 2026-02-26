import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { getN8nRuntime } from './n8n_runtime';

export class GetN8nRecentErrorsWorker extends BaseTool {
  name = '';
  description = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const { eventLog } = await getN8nRuntime();
      const limit = typeof input.limit === 'number' ? Math.max(1, Math.floor(input.limit)) : 20;
      const logs = eventLog.getRecentErrors(limit);

      return {
        successBoolean: true,
        responseString: JSON.stringify({ count: logs.length, logs }, null, 2),
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Failed to read recent n8n errors: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

export const getN8nRecentErrorsRegistration: ToolRegistration = {
  name: 'get_n8n_recent_errors',
  description: 'Get the most recent n8n error log entries.',
  category: 'n8n',
  operationTypes: ['read'],
  schemaDef: {
    limit: { type: 'number' as const, optional: true, description: 'Maximum number of errors to return (default 20).' },
  },
  workerClass: GetN8nRecentErrorsWorker,
};
