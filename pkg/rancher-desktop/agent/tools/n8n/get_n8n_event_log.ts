import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { getN8nRuntime } from './n8n_runtime';

export class GetN8nEventLogWorker extends BaseTool {
  name = '';
  description = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const { eventLog } = await getN8nRuntime();
      const seconds = typeof input.seconds === 'number' ? Math.max(1, Math.floor(input.seconds)) : 30;
      const logs = eventLog.getLast(seconds);

      return {
        successBoolean: true,
        responseString: JSON.stringify({ seconds, count: logs.length, logs }, null, 2),
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Failed to read n8n event log: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

export const getN8nEventLogRegistration: ToolRegistration = {
  name: 'get_n8n_event_log',
  description: 'Get n8n event log entries from the last N seconds.',
  category: 'n8n',
  operationTypes: ['read'],
  schemaDef: {
    seconds: { type: 'number' as const, optional: true, description: 'How far back to read (default 30 seconds).' },
  },
  workerClass: GetN8nEventLogWorker,
};
