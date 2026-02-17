import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Create Credential Tool - Worker class for execution
 */
export class CreateCredentialWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const credential = await service.createCredential(input);

      const responseString = `Credential created successfully:
ID: ${credential.id}
Name: ${credential.name}
Type: ${credential.type}
Created: ${new Date(credential.createdAt).toLocaleString()}
Updated: ${new Date(credential.updatedAt).toLocaleString()}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error creating credential: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const createCredentialRegistration: ToolRegistration = {
  name: "create_credential",
  description: "Create a new credential in n8n.",
  category: "n8n",
  schemaDef: {
    name: { type: 'string' as const, description: "Credential name" },
    type: { type: 'string' as const, description: "Credential type" },
    data: { type: 'string' as const, description: "Credential data" },
    isResolvable: { type: 'boolean' as const, optional: true, description: "Whether the credential is resolvable" },
  },
  workerClass: CreateCredentialWorker,
};
