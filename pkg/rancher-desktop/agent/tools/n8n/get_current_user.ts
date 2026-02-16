import { BaseTool, ToolRegistration } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Get Current User Tool - Worker class for execution
 */
export class GetCurrentUserWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const service = await createN8nService();
    return await service.getCurrentUser();
  }
}

// Export the complete tool registration with type enforcement
export const getCurrentUserRegistration: ToolRegistration = {
  name: "get_current_user",
  description: "Get current user info from n8n.",
  category: "n8n",
  schemaDef: {},
  workerClass: GetCurrentUserWorker,
};
