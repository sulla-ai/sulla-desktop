import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Create Data Table Tool - Worker class for execution
 */
export class CreateDataTableWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const dataTable = await service.createDataTable(input);

      const columnsStr = input.columns.map((col: any) => `${col.name} (${col.type})`).join(', ');
      const responseString = `Data table created successfully:
ID: ${dataTable.id}
Name: ${dataTable.name}
Columns: ${columnsStr}
Created: ${new Date(dataTable.createdAt).toLocaleString()}
Updated: ${new Date(dataTable.updatedAt).toLocaleString()}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error creating data table: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const createDataTableRegistration: ToolRegistration = {
  name: "create_data_table",
  description: "Create a new data table in n8n.",
  category: "n8n",
  operationTypes: ['create'],
  schemaDef: {
    name: { type: 'string' as const, description: "Data table name" },
    columns: { type: 'array' as const, items: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' as const, description: "Column name" },
        type: { type: 'string' as const, description: "Column type" },
      }
    }, description: "Data table columns" },
  },
  workerClass: CreateDataTableWorker,
};
