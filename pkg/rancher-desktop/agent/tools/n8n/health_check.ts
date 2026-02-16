import { BaseTool, ToolRegistration } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Health Check Tool - Worker class for execution
 */
export class HealthCheckWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const service = await createN8nService();
    return await service.healthCheck();
  }
}

// Export the complete tool registration with type enforcement
export const healthCheckRegistration: ToolRegistration = {
  name: "health_check",
  description: "Check if n8n API is accessible and healthy.",
  category: "n8n",
  schemaDef: {},
  workerClass: HealthCheckWorker,
};
