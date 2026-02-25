import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { getIntegrationService } from "../../services/IntegrationService";
import { integrations } from "../../integrations/catalog";

/**
 * Integration List Tool - Worker class for execution
 */
export class IntegrationListWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(_input: any): Promise<ToolResponse> {

    try {
      const service = getIntegrationService();
      await service.initialize();

      const allIntegrations = await Promise.all(
        Object.entries(integrations).map(async ([integration_slug, catalogEntry]) => {
          const status = await service.getConnectionStatus(integration_slug);
          return {
            integration_slug,
            name: catalogEntry.name,
            enabled: status.connected,
            connected_at: status.connected_at ? new Date(status.connected_at).toISOString() : null,
            last_sync_at: status.last_sync_at ? new Date(status.last_sync_at).toISOString() : null,
          };
        }),
      );

      const results = allIntegrations;

      if (results.length === 0) {
        return {
          successBoolean: true,
          responseString: 'No integrations found.',
        };
      }

      let responseString = `Integrations (${results.length})\n`;
      results.forEach((integration) => {
        responseString += `- ${integration.integration_slug} (${integration.name}) | Enabled: ${integration.enabled ? 'Yes' : 'No'} | Connected at: ${integration.connected_at || 'Never'} | Last sync at: ${integration.last_sync_at || 'Never'}\n`;
      });

      return {
        successBoolean: true,
        responseString,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          successBoolean: false,
          responseString: `Error listing integrations: ${error.message}`,
        };
      }

      return {
        successBoolean: false,
        responseString: 'Error listing integrations: Unknown error',
      };
    }
  }
}

export const integrationListRegistration: ToolRegistration = {
  name: "integration_list",
  description: "List all integrations and their connection status, including whether each integration is enabled.",
  category: "integrations",
  operationTypes: ['read'],
  schemaDef: {},
  workerClass: IntegrationListWorker,
};
