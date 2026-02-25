import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Get Data Tables Tool - Worker class for execution
 */
export class GetDataTablesWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const dataTables = await service.getDataTables(input);

      if (!dataTables || dataTables.length === 0) {
        return {
          successBoolean: false,
          responseString: 'No data tables found with the specified filters.'
        };
      }

      let responseString = `n8n Data Tables (${dataTables.length} found):\n\n`;
      dataTables.forEach((table: any, index: number) => {
        const columnsStr = table.columns?.map((col: any) => `${col.name} (${col.type})`).join(', ') || 'None';
        responseString += `${index + 1}. ID: ${table.id}\n`;
        responseString += `   Name: ${table.name}\n`;
        responseString += `   Columns: ${columnsStr}\n`;
        responseString += `   Created: ${new Date(table.createdAt).toLocaleString()}\n`;
        responseString += `   Updated: ${new Date(table.updatedAt).toLocaleString()}\n\n`;
      });

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error getting data tables: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const getDataTablesRegistration: ToolRegistration = {
  name: "get_data_tables",
  description: "Get all data tables from n8n with optional filtering.",
  category: "n8n",
  operationTypes: ['read'],
  schemaDef: {
    limit: { type: 'number' as const, optional: true, description: "Maximum number of results" },
    cursor: { type: 'string' as const, optional: true, description: "Cursor for pagination" },
    filter: { type: 'string' as const, optional: true, description: "Filter criteria" },
    sortBy: { type: 'string' as const, optional: true, description: "Sort field" },
  },
  workerClass: GetDataTablesWorker,
};
