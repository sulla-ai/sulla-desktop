import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { getN8nRuntime } from './n8n_runtime';

export class SearchN8nEventLogWorker extends BaseTool {
  name = '';
  description = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const { eventLog } = await getN8nRuntime();
      const keyword = String(input.keyword || '').trim();
      if (!keyword) {
        return {
          successBoolean: false,
          responseString: 'keyword is required',
        };
      }

      const limit = typeof input.limit === 'number' ? Math.max(1, Math.floor(input.limit)) : 50;
      const logs = eventLog.search(keyword, limit);

      return {
        successBoolean: true,
        responseString: JSON.stringify({ keyword, count: logs.length, logs }, null, 2),
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Failed to search n8n event log: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

export const searchN8nEventLogRegistration: ToolRegistration = {
  name: 'search_n8n_event_log',
  description: 'Search n8n event log by keyword.',
  category: 'n8n',
  operationTypes: ['read'],
  schemaDef: {
    keyword: { type: 'string' as const, description: 'Keyword to search for in log messages/data.' },
    limit: { type: 'number' as const, optional: true, description: 'Maximum number of results (default 50).' },
  },
  workerClass: SearchN8nEventLogWorker,
};
