import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { getIntegrationService } from "../../services/IntegrationService";
import { integrations } from "../../integrations/catalog";

/**
 * Integration Is Enabled Tool - Worker class for execution
 */
export class IntegrationIsEnabledWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { integration_slug } = input;

    try {
      const catalogEntry = integrations[integration_slug];
      if (!catalogEntry) {
        return {
          successBoolean: false,
          responseString: `Integration "${integration_slug}" not found in the catalog. Available integrations: ${Object.keys(integrations).join(', ')}`
        };
      }

      const service = getIntegrationService();
      await service.initialize();
      const status = await service.getConnectionStatus(integration_slug);

      const responseString = `Integration: ${integration_slug} (${catalogEntry.name})
Enabled: ${status.connected ? 'Yes' : 'No'}
Connected at: ${status.connected_at ? new Date(status.connected_at).toLocaleString() : 'Never'}
Last sync at: ${status.last_sync_at ? new Date(status.last_sync_at).toLocaleString() : 'Never'}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          successBoolean: false,
          responseString: `Error checking integration status: ${error.message}`
        };
      } else {
        return {
          successBoolean: false,
          responseString: 'Error checking integration status: Unknown error'
        };
      }
    }
  }
}

// Export the complete tool registration with type enforcement
export const integrationIsEnabledRegistration: ToolRegistration = {
  name: "integration_is_enabled",
  description: "Check whether a specific integration is enabled (connected). Returns the enabled status along with connection timestamps.",
  category: "integrations",
  schemaDef: {
    integration_slug: { type: 'string' as const, description: "The slug identifier of the integration (e.g. 'slack', 'github', 'n8n')" },
  },
  workerClass: IntegrationIsEnabledWorker,
};
