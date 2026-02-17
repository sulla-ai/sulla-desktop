import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Get Variables Tool - Worker class for execution
 */
export class GetVariablesWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const variables = await service.getVariables(input);

      if (!variables || variables.length === 0) {
        return {
          successBoolean: false,
          responseString: 'No variables found with the specified filters.'
        };
      }

      let responseString = `n8n Variables (${variables.length} found):\n\n`;
      variables.forEach((variable: any, index: number) => {
        responseString += `${index + 1}. Key: ${variable.key}\n`;
        responseString += `   Value: ${variable.value}\n`;
        responseString += `   ID: ${variable.id}\n`;
        responseString += `   Project ID: ${variable.projectId || 'Global'}\n`;
        responseString += `   Created: ${new Date(variable.createdAt).toLocaleString()}\n`;
        responseString += `   Updated: ${new Date(variable.updatedAt).toLocaleString()}\n\n`;
      });

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error getting variables: ${(error as Error).message}`
      };
    }
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
