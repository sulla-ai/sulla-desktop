import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Health Check Tool - Worker class for execution
 */
export class HealthCheckWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const health = await service.healthCheck();

      if (health) {
        return {
          successBoolean: true,
          responseString: `n8n Health Status: Healthy - API is accessible and responding`
        };
      } else {
        return {
          successBoolean: false,
          responseString: `n8n Health Status: Unhealthy - API is not accessible or not responding`
        };
      }
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error checking n8n health: ${(error as Error).message}`
      };
    }
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
