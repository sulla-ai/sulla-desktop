import type { ToolManifest } from '../registry';

export const integrationsToolManifests: ToolManifest[] = [
  {
    name: 'integration_get_credentials',
    description: 'Retrieve the credentials and connection status for a specific integration. Returns each credential property name, title, type, whether it is required, and its stored value, along with whether the integration is enabled.',
    category: 'integrations',
    schemaDef: {
    integration_slug: { type: 'string', description: "The slug identifier of the integration (e.g. 'slack', 'github', 'n8n')" },
  },
    operationTypes: ['read'],
    loader: () => import('./integration_get_credentials'),
  },
  {
    name: 'integration_is_enabled',
    description: 'Check whether a specific integration is enabled (connected). Returns the enabled status along with connection timestamps.',
    category: 'integrations',
    schemaDef: {
    integration_slug: { type: 'string', description: "The slug identifier of the integration (e.g. 'slack', 'github', 'n8n')" },
  },
    operationTypes: ['read'],
    loader: () => import('./integration_is_enabled'),
  },
  {
    name: 'integration_list',
    description: 'List all integrations and their connection status, including whether each integration is enabled.',
    category: 'integrations',
    schemaDef: {},
    operationTypes: ['read'],
    loader: () => import('./integration_list'),
  },
];
