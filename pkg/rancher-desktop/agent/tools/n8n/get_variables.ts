import { BaseTool, ToolRegistration } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Get Variables Tool - Worker class for execution
 */
export class GetVariablesWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const service = await createN8nService();
    return await service.getVariables(input);
  }
}

// Export the complete tool registration with type enforcement
export const getVariablesRegistration: ToolRegistration = {
  name: "get_variables",
  description: "Get all variables from n8n with optional filtering.",
  category: "n8n",
  schemaDef: {
    limit: { type: 'number' as const, optional: true, description: "Maximum number of results" },
    cursor: { type: 'string' as const, optional: true, description: "Cursor for pagination" },
    projectId: { type: 'string' as const, optional: true, description: "Filter by project ID" },
    state: { type: 'enum' as const, enum: ["empty"], optional: true, description: "Filter by state" },
  },
  workerClass: GetVariablesWorker,
};
