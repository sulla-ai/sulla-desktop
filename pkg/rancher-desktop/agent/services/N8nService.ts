// N8nService - Service for interacting with n8n API
// Provides methods to manage workflows, executions, credentials, and other n8n resources

import Logging from '@pkg/utils/logging';
import { SullaSettingsModel } from '../database/models/SullaSettingsModel';

const console = Logging.agent;

/**
 * N8n API Service
 * Handles all interactions with the n8n REST API
 */
export class N8nService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    // Initialize with empty defaults - call initialize() to set values
    this.baseUrl = '';
    this.apiKey = '';
  }

  /**
   * Initialize the service with configuration values
   */
  async initialize(): Promise<void> {
    console.log('[N8nService] Initializing...');
    // Load API key from settings
    const serviceAccountKey = await SullaSettingsModel.get('serviceAccountApiKey');

    console.log('serviceAccountKey :'+serviceAccountKey);

    if (!serviceAccountKey) {
      throw new Error('No API key found in settings');
    }
    this.apiKey = serviceAccountKey;
    this.baseUrl = 'http://localhost:30119';

    console.log('[Background] N8nService initialized');
  }

  /**
   * Make authenticated request to n8n API
   */
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...options.headers as Record<string, string>
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`N8n API error ${response.status}: ${response.statusText} - ${errorText}`);
      }

      // For DELETE requests, may not have body
      if (response.status === 204 || options.method === 'DELETE') {
        return { success: true };
      }

      return await response.json();
    } catch (error) {
      console.error(`[N8nService] Request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // ========== WORKFLOWS ==========

  /**
   * Get all workflows
   */
  async getWorkflows(params?: {
    active?: boolean;
    tags?: string;
    name?: string;
    projectId?: string;
    excludePinnedData?: boolean;
    limit?: number;
    cursor?: string;
  }): Promise<any[]> {
    let url = '/api/v1/workflows';

    if (params) {
      const queryParams = new URLSearchParams();

      if (params.active !== undefined) {
        queryParams.append('active', params.active.toString());
      }

      if (params.tags) {
        queryParams.append('tags', params.tags);
      }

      if (params.name) {
        queryParams.append('name', params.name);
      }

      if (params.projectId) {
        queryParams.append('projectId', params.projectId);
      }

      if (params.excludePinnedData !== undefined) {
        queryParams.append('excludePinnedData', params.excludePinnedData.toString());
      }

      if (params.limit !== undefined) {
        queryParams.append('limit', Math.min(params.limit, 250).toString());
      }

      if (params.cursor) {
        queryParams.append('cursor', params.cursor);
      }

      const queryString = queryParams.toString();
      if (queryString) {
        url += '?' + queryString;
      }
    }

    const result = await this.request(url);
    return result.data || result;
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(id: string, excludePinnedData?: boolean): Promise<any> {
    let url = `/api/v1/workflows/${id}`;

    if (excludePinnedData !== undefined) {
      const queryParams = new URLSearchParams();
      queryParams.append('excludePinnedData', excludePinnedData.toString());
      url += '?' + queryParams.toString();
    }

    return this.request(url);
  }

  /**
   * Get specific version of a workflow
   */
  async getWorkflowVersion(id: string, versionId: string): Promise<any> {
    return this.request(`/api/v1/workflows/${id}/${versionId}`);
  }

  /**
   * Get workflow tags
   */
  async getWorkflowTags(id: string): Promise<any[]> {
    const result = await this.request(`/api/v1/workflows/${id}/tags`);
    return result.data || result;
  }

  /**
   * Update workflow tags
   */
  async updateWorkflowTags(id: string, tags: { id: string }[]): Promise<any> {
    return this.request(`/api/v1/workflows/${id}/tags`, {
      method: 'PUT',
      body: JSON.stringify(tags)
    });
  }

  /**
   * Create a new workflow
   */
  async createWorkflow(workflowData: {
    name: string;
    nodes: any[];
    connections: any;
    settings: {
      saveExecutionProgress?: boolean;
      saveManualExecutions?: boolean;
      saveDataErrorExecution?: string;
      saveDataSuccessExecution?: string;
      executionTimeout?: number;
      errorWorkflow?: string;
      timezone?: string;
      executionOrder?: string;
      callerPolicy?: string;
      callerIds?: string;
      timeSavedPerExecution?: number;
      availableInMCP?: boolean;
    };
    shared?: any[];
    staticData?: any;
  }): Promise<any> {
    return this.request('/api/v1/workflows', {
      method: 'POST',
      body: JSON.stringify(workflowData)
    });
  }

  /**
   * Update an existing workflow
   */
  async updateWorkflow(id: string, workflowData: {
    name: string;
    nodes: any[];
    connections: any;
    settings: {
      saveExecutionProgress?: boolean;
      saveManualExecutions?: boolean;
      saveDataErrorExecution?: string;
      saveDataSuccessExecution?: string;
      executionTimeout?: number;
      errorWorkflow?: string;
      timezone?: string;
      executionOrder?: string;
      callerPolicy?: string;
      callerIds?: string;
      timeSavedPerExecution?: number;
      availableInMCP?: boolean;
    };
    shared?: any[];
    staticData?: any;
  }): Promise<any> {
    return this.request(`/api/v1/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(workflowData)
    });
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(id: string): Promise<any> {
    return this.request(`/api/v1/workflows/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Activate a workflow
   */
  async activateWorkflow(id: string, options?: {
    versionId?: string;
    name?: string;
    description?: string;
  }): Promise<any> {
    const body = options ? {
      versionId: options.versionId || '',
      name: options.name || '',
      description: options.description || ''
    } : {};

    return this.request(`/api/v1/workflows/${id}/activate`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * Deactivate a workflow
   */
  async deactivateWorkflow(id: string): Promise<any> {
    return this.request(`/api/v1/workflows/${id}/deactivate`, {
      method: 'POST'
    });
  }

  // ========== EXECUTIONS ==========

  /**
   * Get all executions
   */
  async getExecutions(params?: {
    includeData?: boolean;
    status?: 'canceled' | 'error' | 'running' | 'success' | 'waiting';
    workflowId?: string;
    projectId?: string;
    limit?: number;
    cursor?: string;
  }): Promise<any[]> {
    let url = '/api/v1/executions';

    if (params) {
      const queryParams = new URLSearchParams();

      if (params.includeData !== undefined) {
        queryParams.append('includeData', params.includeData.toString());
      }

      if (params.status) {
        queryParams.append('status', params.status);
      }

      if (params.workflowId) {
        queryParams.append('workflowId', params.workflowId);
      }

      if (params.projectId) {
        queryParams.append('projectId', params.projectId);
      }

      if (params.limit !== undefined) {
        queryParams.append('limit', Math.min(params.limit, 250).toString());
      }

      if (params.cursor) {
        queryParams.append('cursor', params.cursor);
      }

      const queryString = queryParams.toString();
      if (queryString) {
        url += '?' + queryString;
      }
    }

    const result = await this.request(url);
    return result.data || result;
  }

  /**
   * Get execution by ID
   */
  async getExecution(id: string): Promise<any> {
    return this.request(`/api/v1/executions/${id}`);
  }

  /**
   * Create a new execution (run workflow)
   */
  async createExecution(executionData: any): Promise<any> {
    return this.request('/api/v1/executions', {
      method: 'POST',
      body: JSON.stringify(executionData)
    });
  }

  /**
   * Delete an execution
   */
  async deleteExecution(id: string): Promise<any> {
    return this.request(`/api/v1/executions/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Retry an execution
   */
  async retryExecution(id: string, loadWorkflow?: boolean): Promise<any> {
    const retryData = {
      loadWorkflow: loadWorkflow ?? true
    };

    return this.request(`/api/v1/executions/${id}/retry`, {
      method: 'POST',
      body: JSON.stringify(retryData)
    });
  }

  // ========== CREDENTIALS ==========

  /**
   * Get all credentials
   */
  async getCredentials(params?: {
    limit?: number;
    cursor?: string;
  }): Promise<any[]> {
    let url = '/api/v1/credentials';

    if (params) {
      const queryParams = new URLSearchParams();

      if (params.limit !== undefined) {
        queryParams.append('limit', Math.min(params.limit, 250).toString());
      }

      if (params.cursor) {
        queryParams.append('cursor', params.cursor);
      }

      const queryString = queryParams.toString();
      if (queryString) {
        url += '?' + queryString;
      }
    }

    const result = await this.request(url);
    return result.data || result;
  }

  /**
   * Get credential by ID
   */
  async getCredential(id: string): Promise<any> {
    return this.request(`/api/v1/credentials/${id}`);
  }

  /**
   * Create a new credential
   */
  async createCredential(credentialData: {
    name: string;
    type: string;
    data: any;
    isResolvable?: boolean;
  }): Promise<any> {
    return this.request('/api/v1/credentials', {
      method: 'POST',
      body: JSON.stringify(credentialData)
    });
  }

  /**
   * Update a credential
   */
  async updateCredential(id: string, credentialData: {
    name?: string;
    type?: string;
    data?: any;
    isGlobal?: boolean;
    isResolvable?: boolean;
    isPartialData?: boolean;
  }): Promise<any> {
    return this.request(`/api/v1/credentials/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(credentialData)
    });
  }

  /**
   * Delete a credential
   */
  async deleteCredential(id: string): Promise<any> {
    return this.request(`/api/v1/credentials/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get credential schema by type
   */
  async getCredentialSchema(credentialTypeName: string): Promise<any> {
    return this.request(`/api/v1/credentials/schema/${credentialTypeName}`);
  }

  // ========== TAGS ==========

  /**
   * Get all tags
   */
  async getTags(): Promise<any[]> {
    const result = await this.request('/api/v1/tags');
    return result.data || result;
  }

  /**
   * Get tag by ID
   */
  async getTag(id: string): Promise<any> {
    return this.request(`/api/v1/tags/${id}`);
  }

  /**
   * Create a new tag
   */
  async createTag(tagData: {
    name: string;
  }): Promise<any> {
    return this.request('/api/v1/tags', {
      method: 'POST',
      body: JSON.stringify(tagData)
    });
  }

  /**
   * Delete a tag
   */
  async deleteTag(id: string): Promise<any> {
    return this.request(`/api/v1/tags/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Update a tag
   */
  async updateTag(id: string, tagData: {
    name: string;
  }): Promise<any> {
    return this.request(`/api/v1/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(tagData)
    });
  }

  // ========== USERS (if available) ==========

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<any> {
    return this.request('/api/v1/users/me');
  }

  // ========== HEALTH CHECK ==========

  /**
   * Check if n8n API is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request('/healthz', { method: 'GET' });
      return true;
    } catch (error) {
      console.error('[N8nService] Health check failed:', error);
      return false;
    }
  }

  // ========== SOURCE CONTROL ==========

  /**
   * Pull changes from remote repository
   */
  async pullFromSourceControl(options?: {
    force?: boolean;
    autoPublish?: 'none' | 'all' | 'published';
    variables?: Record<string, any>;
  }): Promise<any> {
    const pullData = {
      force: options?.force || false,
      autoPublish: options?.autoPublish || 'none',
      variables: options?.variables || {}
    };

    return this.request('/api/v1/source-control/pull', {
      method: 'POST',
      body: JSON.stringify(pullData)
    });
  }

  // ========== VARIABLES ==========

  /**
   * Get all variables
   */
  async getVariables(params?: {
    limit?: number;
    cursor?: string;
    projectId?: string;
    state?: 'empty';
  }): Promise<any[]> {
    let url = '/api/v1/variables';

    if (params) {
      const queryParams = new URLSearchParams();

      if (params.limit !== undefined) {
        queryParams.append('limit', Math.min(params.limit, 250).toString());
      }

      if (params.cursor) {
        queryParams.append('cursor', params.cursor);
      }

      if (params.projectId) {
        queryParams.append('projectId', params.projectId);
      }

      if (params.state) {
        queryParams.append('state', params.state);
      }

      const queryString = queryParams.toString();
      if (queryString) {
        url += '?' + queryString;
      }
    }

    const result = await this.request(url);
    return result.data || result;
  }

  /**
   * Create a variable
   */
  async createVariable(variableData: {
    key: string;
    value: string;
    projectId?: string | null;
  }): Promise<any> {
    return this.request('/api/v1/variables', {
      method: 'POST',
      body: JSON.stringify(variableData)
    });
  }

  /**
   * Delete a variable
   */
  async deleteVariable(id: string): Promise<any> {
    return this.request(`/api/v1/variables/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Update a variable
   */
  async updateVariable(id: string, variableData: {
    key: string;
    value: string;
    projectId?: string | null;
  }): Promise<any> {
    return this.request(`/api/v1/variables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(variableData)
    });
  }

  // ========== DATA TABLES ==========

  /**
   * Get all data tables
   */
  async getDataTables(params?: {
    limit?: number;
    cursor?: string;
    filter?: any;
    sortBy?: string;
  }): Promise<any[]> {
    let url = '/api/v1/data-tables';

    if (params) {
      const queryParams = new URLSearchParams();

      if (params.limit !== undefined) {
        queryParams.append('limit', Math.min(params.limit, 250).toString());
      }

      if (params.cursor) {
        queryParams.append('cursor', params.cursor);
      }

      if (params.filter) {
        queryParams.append('filter', JSON.stringify(params.filter));
      }

      if (params.sortBy) {
        queryParams.append('sortBy', params.sortBy);
      }

      const queryString = queryParams.toString();
      if (queryString) {
        url += '?' + queryString;
      }
    }

    const result = await this.request(url);
    return result.data || result;
  }

  /**
   * Create a new data table
   */
  async createDataTable(tableData: {
    name: string;
    columns: Array<{
      name: string;
      type: string;
    }>;
  }): Promise<any> {
    return this.request('/api/v1/data-tables', {
      method: 'POST',
      body: JSON.stringify(tableData)
    });
  }

  /**
   * Get a specific data table by ID
   */
  async getDataTable(dataTableId: string): Promise<any> {
    return this.request(`/api/v1/data-tables/${dataTableId}`);
  }

  /**
   * Update a data table
   */
  async updateDataTable(dataTableId: string, tableData: {
    name: string;
  }): Promise<any> {
    return this.request(`/api/v1/data-tables/${dataTableId}`, {
      method: 'PATCH',
      body: JSON.stringify(tableData)
    });
  }

  /**
   * Delete a data table
   */
  async deleteDataTable(dataTableId: string): Promise<any> {
    return this.request(`/api/v1/data-tables/${dataTableId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get rows from a data table
   */
  async getDataTableRows(dataTableId: string, params?: {
    limit?: number;
    cursor?: string;
    filter?: any;
    sortBy?: string;
    search?: string;
  }): Promise<any[]> {
    let url = `/api/v1/data-tables/${dataTableId}/rows`;

    if (params) {
      const queryParams = new URLSearchParams();

      if (params.limit !== undefined) {
        queryParams.append('limit', Math.min(params.limit, 250).toString());
      }

      if (params.cursor) {
        queryParams.append('cursor', params.cursor);
      }

      if (params.filter) {
        queryParams.append('filter', JSON.stringify(params.filter));
      }

      if (params.sortBy) {
        queryParams.append('sortBy', params.sortBy);
      }

      if (params.search) {
        queryParams.append('search', params.search);
      }

      const queryString = queryParams.toString();
      if (queryString) {
        url += '?' + queryString;
      }
    }

    const result = await this.request(url);
    return result.data || result;
  }

  /**
   * Create rows in a data table
   */
  async createDataTableRows(dataTableId: string, rowData: {
    data: any[];
    returnType?: 'count' | 'id' | 'all';
  }): Promise<any> {
    return this.request(`/api/v1/data-tables/${dataTableId}/rows`, {
      method: 'POST',
      body: JSON.stringify(rowData)
    });
  }

  /**
   * Update rows in a data table
   */
  async updateDataTableRows(dataTableId: string, updateData: {
    filter: any;
    data: any;
    returnData?: boolean;
    dryRun?: boolean;
  }): Promise<any> {
    return this.request(`/api/v1/data-tables/${dataTableId}/rows/update`, {
      method: 'PATCH',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Upsert a row in a data table
   */
  async upsertDataTableRow(dataTableId: string, upsertData: {
    filter: any;
    data: any;
    returnData?: boolean;
    dryRun?: boolean;
  }): Promise<any> {
    return this.request(`/api/v1/data-tables/${dataTableId}/rows/upsert`, {
      method: 'POST',
      body: JSON.stringify(upsertData)
    });
  }

  /**
   * Delete rows from a data table
   */
  async deleteDataTableRows(dataTableId: string, deleteOptions: {
    filter: any;
    returnData?: boolean;
    dryRun?: boolean;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    queryParams.append('filter', JSON.stringify(deleteOptions.filter));

    if (deleteOptions.returnData !== undefined) {
      queryParams.append('returnData', deleteOptions.returnData.toString());
    }

    if (deleteOptions.dryRun !== undefined) {
      queryParams.append('dryRun', deleteOptions.dryRun.toString());
    }

    const url = `/api/v1/data-tables/${dataTableId}/rows?${queryParams.toString()}`;

    return this.request(url, {
      method: 'DELETE'
    });
  }
  
  async createAudit(options: {
    daysAbandonedWorkflow?: number;
    categories?: string[];
  }): Promise<any> {
    const auditData = {
      additionalOptions: {
        daysAbandonedWorkflow: options.daysAbandonedWorkflow || 1,
        categories: options.categories || ['credentials']
      }
    };

    return this.request('/api/v1/audit', {
      method: 'POST',
      body: JSON.stringify(auditData)
    });
  }
}

// Export a factory function for creating configured instance
export async function createN8nService(): Promise<N8nService> {
  const service = new N8nService();
  await service.initialize();
  return service;
}
