import { BaseTool, ToolRegistration } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Create Variable Tool - Worker class for execution
 */
export class CreateVariableWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const service = await createN8nService();
    return await service.createVariable(input);
  }
}

// Export the complete tool registration with type enforcement
export const createVariableRegistration: ToolRegistration = {
  name: "create_variable",
  description: "Create a new variable in n8n.",
  category: "n8n",
  schemaDef: {
    key: { type: 'string' as const, description: "Variable key" },
    value: { type: 'string' as const, description: "Variable value" },
    projectId: { type: 'string' as const, nullable: true, optional: true, description: "Project ID or null for global" },
  },
  workerClass: CreateVariableWorker,
};
