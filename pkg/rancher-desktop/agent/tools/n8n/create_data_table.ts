import { BaseTool, ToolRegistration } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Create Data Table Tool - Worker class for execution
 */
export class CreateDataTableWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const service = await createN8nService();
    return await service.createDataTable(input);
  }
}

// Export the complete tool registration with type enforcement
export const createDataTableRegistration: ToolRegistration = {
  name: "create_data_table",
  description: "Create a new data table in n8n.",
  category: "n8n",
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
