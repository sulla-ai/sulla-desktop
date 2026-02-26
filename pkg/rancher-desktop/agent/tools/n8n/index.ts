// Import all n8n tool registrations
import { getWorkflowsRegistration } from './get_workflows';
import { createWorkflowRegistration } from './create_workflow';
import { cloneWorkflowRegistration } from './clone_workflow';
import { deleteWorkflowRegistration } from './delete_workflow';
import { getWorkflowRegistration } from './get_workflow';
import { getWorkflowConnectionsRegistration } from './get_workflow_connections';
import { validateWorkflowRegistration } from './validate_workflow';
import { listCredentialsRegistration } from './get_credentials';
import { getCredentialRegistration } from './get_credential';
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
import { setWorkflowActiveRegistration } from './set_workflow_active';
import { archiveWorkflowRegistration } from './archive_workflow';
import { searchTemplatesRegistration } from './search_templates';
import { getTemplateWorkflowRegistration } from './get_template_workflow';
import { getTemplateCollectionsRegistration } from './get_template_collections';
import { getTemplateCategoriesRegistration } from './get_template_categories';
import { validateWorkflowPayloadRegistration } from './validate_workflow_payload';
import { getWorkflowNodeRegistration } from './get_workflow_node';
import { getWorkflowNodeListRegistration } from './get_workflow_node_list';
import { patchWorkflowRegistration } from './patch_workflow';
import { executeN8nWorkflowBridgeRegistration } from './execute_n8n_workflow';
import { listWorkflowExecutionsRegistration } from './list_workflow_executions';
import { getExecutionLogRegistration } from './get_execution_log';

// Export all n8n tool registrations as an array
export const n8nToolRegistrations = [
  getWorkflowsRegistration,
  createWorkflowRegistration,
  cloneWorkflowRegistration,
  deleteWorkflowRegistration,
  getWorkflowRegistration,
  getWorkflowConnectionsRegistration,
  validateWorkflowRegistration,
  listCredentialsRegistration,
  getCredentialRegistration,
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
  setWorkflowActiveRegistration,
  archiveWorkflowRegistration,
  searchTemplatesRegistration,
  getTemplateWorkflowRegistration,
  getTemplateCollectionsRegistration,
  getTemplateCategoriesRegistration,
  validateWorkflowPayloadRegistration,
  getWorkflowNodeRegistration,
  getWorkflowNodeListRegistration,
  patchWorkflowRegistration,
  executeN8nWorkflowBridgeRegistration,
  listWorkflowExecutionsRegistration,
  getExecutionLogRegistration,
];
