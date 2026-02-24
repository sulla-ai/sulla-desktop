import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Get Credentials Tool - Worker class for execution
 */
export class GetCredentialsWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const result = await service.getCredentials(input);

      if (result.length > 0) {
        // Format a proper message for the LLM
        const credentialCount = result.length;
        const responseString = `Found ${credentialCount} n8n credentials:\n\n` +
          result.map((cred: any, index: number) =>
            `${index + 1}. **${cred.name}** (Type: ${cred.type})`
          ).join('\n');

        return {
          successBoolean: true,
          responseString
        };
      }

      return {
        successBoolean: false,
        responseString: 'No credentials found.'
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error getting credentials: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const getCredentialsRegistration: ToolRegistration = {
  name: "get_credentials",
  description: "Get all credentials from n8n with optional filtering.",
  category: "n8n",
  operationTypes: ['read'],
  schemaDef: {
    limit: { type: 'number' as const, optional: true, description: "Maximum number of results" },
    cursor: { type: 'string' as const, optional: true, description: "Cursor for pagination" },
  },
  workerClass: GetCredentialsWorker,
};
