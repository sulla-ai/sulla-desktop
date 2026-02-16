import { BaseTool, ToolRegistration } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Create Credential Tool - Worker class for execution
 */
export class CreateCredentialWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const service = await createN8nService();
    return await service.createCredential(input);
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
