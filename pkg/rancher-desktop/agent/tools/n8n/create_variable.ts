import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Create Variable Tool - Worker class for execution
 */
export class CreateVariableWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const variable = await service.createVariable(input);

      const responseString = `Variable created successfully:
ID: ${variable.id}
Key: ${variable.key}
Value: ${variable.value}
Project ID: ${variable.projectId || 'Global'}
Created: ${new Date(variable.createdAt).toLocaleString()}
Updated: ${new Date(variable.updatedAt).toLocaleString()}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error creating variable: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const createVariableRegistration: ToolRegistration = {
  name: "create_variable",
  description: "Create a new variable in n8n.",
  category: "n8n",
  operationTypes: ['create'],
  schemaDef: {
    key: { type: 'string' as const, description: "Variable key" },
    value: { type: 'string' as const, description: "Variable value" },
    projectId: { type: 'string' as const, nullable: true, optional: true, description: "Project ID or null for global" },
  },
  workerClass: CreateVariableWorker,
};
