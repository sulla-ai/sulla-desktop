import { BaseTool, ToolRegistration } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Get Data Tables Tool - Worker class for execution
 */
export class GetDataTablesWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const service = await createN8nService();
    return await service.getDataTables(input);
  }
}

// Export the complete tool registration with type enforcement
export const getDataTablesRegistration: ToolRegistration = {
  name: "get_data_tables",
  description: "Get all data tables from n8n with optional filtering.",
  category: "n8n",
  schemaDef: {
    limit: { type: 'number' as const, optional: true, description: "Maximum number of results" },
    cursor: { type: 'string' as const, optional: true, description: "Cursor for pagination" },
    filter: { type: 'string' as const, optional: true, description: "Filter criteria" },
    sortBy: { type: 'string' as const, optional: true, description: "Sort field" },
  },
  workerClass: GetDataTablesWorker,
};
