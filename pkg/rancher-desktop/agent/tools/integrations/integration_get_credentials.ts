import { BaseTool, ToolRegistration } from "../base";
import { getIntegrationService } from "../../services/IntegrationService";
import { integrations } from "../../integrations/catalog";

/**
 * Integration Get Credentials Tool - Worker class for execution
 */
export class IntegrationGetCredentialsWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { integration_slug } = input;

    try {
      const catalogEntry = integrations[integration_slug];
      if (!catalogEntry) {
        return `Integration "${integration_slug}" not found in the catalog. Available integrations: ${Object.keys(integrations).join(', ')}`;
      }

      const service = getIntegrationService();
      await service.initialize();

      const status = await service.getConnectionStatus(integration_slug);
      const formValues = await service.getFormValues(integration_slug);

      // Build a map of property key -> stored value
      const storedValues: Record<string, string> = {};
      for (const fv of formValues) {
        storedValues[fv.property] = fv.value;
      }

      // Build credentials list from catalog properties with stored values
      const credentials = (catalogEntry.properties ?? []).map(prop => ({
        key: prop.key,
        title: prop.title,
        type: prop.type,
        required: prop.required,
        value: storedValues[prop.key] ?? null,
        has_value: prop.key in storedValues,
      }));

      return {
        integration_id: integration_slug,
        name: catalogEntry.name,
        enabled: status.connected,
        connected_at: status.connected_at ?? null,
        last_sync_at: status.last_sync_at ?? null,
        credentials,
      };
    } catch (error) {
      if (error instanceof Error) {
        return `Error retrieving integration credentials: ${error.message}`;
      } else {
        return 'Error retrieving integration credentials: Unknown error';
      }
    }
  }
}

// Export the complete tool registration with type enforcement
export const integrationGetCredentialsRegistration: ToolRegistration = {
  name: "integration_get_credentials",
  description: "Retrieve the credentials and connection status for a specific integration. Returns each credential property name, title, type, whether it is required, and its stored value, along with whether the integration is enabled.",
  category: "integrations",
  schemaDef: {
    integration_slug: { type: 'string' as const, description: "The slug identifier of the integration (e.g. 'slack', 'github', 'n8n')" },
  },
  workerClass: IntegrationGetCredentialsWorker,
};
