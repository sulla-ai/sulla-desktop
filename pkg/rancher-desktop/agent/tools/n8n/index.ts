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
import { archiveWorkflowRegistration } from './archive_workflow';
import { searchTemplatesRegistration } from './search_templates';
import { getTemplateWorkflowRegistration } from './get_template_workflow';
import { getTemplateCollectionsRegistration } from './get_template_collections';
import { getTemplateCategoriesRegistration } from './get_template_categories';
import { validateWorkflowPayloadRegistration } from './validate_workflow_payload';
import { getWorkflowNodeRegistration } from './get_workflow_node';
import { getWorkflowNodeListRegistration } from './get_workflow_node_list';
import { addWorkflowNodeRegistration } from './add_workflow_node';
import { updateWorkflowNodeRegistration } from './update_workflow_node';
import { removeWorkflowNodeRegistration } from './remove_workflow_node';
import { getN8nStateRegistration } from './get_n8n_state';
import { refreshN8nStateRegistration } from './refresh_n8n_state';
import { getN8nEventLogRegistration } from './get_n8n_event_log';
import { searchN8nEventLogRegistration } from './search_n8n_event_log';
import { getN8nRecentErrorsRegistration } from './get_n8n_recent_errors';
import { getN8nWorkflowBridgeRegistration } from './get_n8n_workflow_bridge';
import { updateN8nWorkflowBridgeRegistration } from './update_n8n_workflow_bridge';
import { runN8nWorkflowBridgeRegistration } from './run_n8n_workflow_bridge';
import { waitN8nExecutionCompleteRegistration } from './wait_n8n_execution_complete';

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
  archiveWorkflowRegistration,
  searchTemplatesRegistration,
  getTemplateWorkflowRegistration,
  getTemplateCollectionsRegistration,
  getTemplateCategoriesRegistration,
  validateWorkflowPayloadRegistration,
  getWorkflowNodeRegistration,
  getWorkflowNodeListRegistration,
  addWorkflowNodeRegistration,
  updateWorkflowNodeRegistration,
  removeWorkflowNodeRegistration,
  getN8nStateRegistration,
  refreshN8nStateRegistration,
  getN8nEventLogRegistration,
  searchN8nEventLogRegistration,
  getN8nRecentErrorsRegistration,
  getN8nWorkflowBridgeRegistration,
  updateN8nWorkflowBridgeRegistration,
  runN8nWorkflowBridgeRegistration,
  waitN8nExecutionCompleteRegistration,
];
