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

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { filter_by_enabled = true } = input;

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

      const results = filter_by_enabled
        ? allIntegrations.filter((integration) => integration.enabled)
        : allIntegrations;

      if (results.length === 0) {
        return {
          successBoolean: true,
          responseString: 'No integrations matched the provided filter.',
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
  description: "List integrations and their connection status. Use filter_by_enabled=true to return only enabled integrations.",
  category: "integrations",
  operationTypes: ['read'],
  schemaDef: {
    filter_by_enabled: {
      type: 'boolean' as const,
      description: 'When true, only returns integrations that are enabled (connected).',
      default: true,
      optional: true,
    },
  },
  workerClass: IntegrationListWorker,
};
