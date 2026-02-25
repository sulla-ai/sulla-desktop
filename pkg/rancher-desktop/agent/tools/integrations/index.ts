// Import all integration tool registrations
import { integrationIsEnabledRegistration } from './integration_is_enabled';
import { integrationGetCredentialsRegistration } from './integration_get_credentials';
import { integrationListRegistration } from './integration_list';

// Export all integration tool registrations as an array
export const integrationToolRegistrations = [
  integrationIsEnabledRegistration,
  integrationGetCredentialsRegistration,
  integrationListRegistration,
];
