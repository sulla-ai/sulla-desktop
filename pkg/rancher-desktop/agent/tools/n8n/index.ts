// Import all n8n tool registrations
import { getWorkflowsRegistration } from './get_workflows';
import { createWorkflowRegistration } from './create_workflow';
import { deleteWorkflowRegistration } from './delete_workflow';
import { getWorkflowRegistration } from './get_workflow';
import { getCredentialsRegistration } from './get_credentials';
import { createCredentialRegistration } from './create_credential';
import { getDataTablesRegistration } from './get_data_tables';
import { createDataTableRegistration } from './create_data_table';
import { updateWorkflowRegistration } from './update_workflow';
import { healthCheckRegistration } from './health_check';
import { getCurrentUserRegistration } from './get_current_user';
import { createVariableRegistration } from './create_variable';
import { getVariablesRegistration } from './get_variables';
import { getTagsRegistration } from './get_tags';
import { activateWorkflowRegistration } from './activate_workflow';
import { deactivateWorkflowRegistration } from './deactivate_workflow';

// Export all n8n tool registrations as an array
export const n8nToolRegistrations = [
  getWorkflowsRegistration,
  createWorkflowRegistration,
  deleteWorkflowRegistration,
  getWorkflowRegistration,
  getCredentialsRegistration,
  createCredentialRegistration,
  getDataTablesRegistration,
  createDataTableRegistration,
  updateWorkflowRegistration,
  healthCheckRegistration,
  getCurrentUserRegistration,
  createVariableRegistration,
  getVariablesRegistration,
  getTagsRegistration,
  activateWorkflowRegistration,
  deactivateWorkflowRegistration,
];
