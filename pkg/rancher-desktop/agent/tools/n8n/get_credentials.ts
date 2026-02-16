import { BaseTool, ToolRegistration } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Get Credentials Tool - Worker class for execution
 */
export class GetCredentialsWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const service = await createN8nService();
    return await service.getCredentials(input);
  }
}

// Export the complete tool registration with type enforcement
export const getCredentialsRegistration: ToolRegistration = {
  name: "get_credentials",
  description: "Get all credentials from n8n with optional filtering.",
  category: "n8n",
  schemaDef: {
    limit: { type: 'number' as const, optional: true, description: "Maximum number of results" },
    cursor: { type: 'string' as const, optional: true, description: "Cursor for pagination" },
  },
  workerClass: GetCredentialsWorker,
};
