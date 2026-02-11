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
  async getWorkflows(): Promise<any[]> {

    const result = await this.request('/rest/workflows');
    return result.data || result;
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(id: string): Promise<any> {
    return this.request(`/rest/workflows/${id}`);
  }

  /**
   * Create a new workflow
   */
  async createWorkflow(workflowData: any): Promise<any> {
    return this.request('/rest/workflows', {
      method: 'POST',
      body: JSON.stringify(workflowData)
    });
  }

  /**
   * Update an existing workflow
   */
  async updateWorkflow(id: string, workflowData: any): Promise<any> {
    return this.request(`/rest/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(workflowData)
    });
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(id: string): Promise<any> {
    return this.request(`/rest/workflows/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Activate a workflow
   */
  async activateWorkflow(id: string): Promise<any> {
    return this.request(`/rest/workflows/${id}/activate`, {
      method: 'POST'
    });
  }

  /**
   * Deactivate a workflow
   */
  async deactivateWorkflow(id: string): Promise<any> {
    return this.request(`/rest/workflows/${id}/deactivate`, {
      method: 'POST'
    });
  }

  // ========== EXECUTIONS ==========

  /**
   * Get all executions
   */
  async getExecutions(): Promise<any[]> {
    const result = await this.request('/rest/executions');
    return result.data || result;
  }

  /**
   * Get execution by ID
   */
  async getExecution(id: string): Promise<any> {
    return this.request(`/rest/executions/${id}`);
  }

  /**
   * Create a new execution (run workflow)
   */
  async createExecution(executionData: any): Promise<any> {
    return this.request('/rest/executions', {
      method: 'POST',
      body: JSON.stringify(executionData)
    });
  }

  /**
   * Delete an execution
   */
  async deleteExecution(id: string): Promise<any> {
    return this.request(`/rest/executions/${id}`, {
      method: 'DELETE'
    });
  }

  // ========== CREDENTIALS ==========

  /**
   * Get all credentials
   */
  async getCredentials(): Promise<any[]> {
    const result = await this.request('/rest/credentials');
    return result.data || result;
  }

  /**
   * Get credential by ID
   */
  async getCredential(id: string): Promise<any> {
    return this.request(`/rest/credentials/${id}`);
  }

  /**
   * Create a new credential
   */
  async createCredential(credentialData: any): Promise<any> {
    return this.request('/rest/credentials', {
      method: 'POST',
      body: JSON.stringify(credentialData)
    });
  }

  /**
   * Update a credential
   */
  async updateCredential(id: string, credentialData: any): Promise<any> {
    return this.request(`/rest/credentials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(credentialData)
    });
  }

  /**
   * Delete a credential
   */
  async deleteCredential(id: string): Promise<any> {
    return this.request(`/rest/credentials/${id}`, {
      method: 'DELETE'
    });
  }

  // ========== TAGS ==========

  /**
   * Get all tags
   */
  async getTags(): Promise<any[]> {
    const result = await this.request('/rest/tags');
    return result.data || result;
  }

  /**
   * Create a new tag
   */
  async createTag(tagData: any): Promise<any> {
    return this.request('/rest/tags', {
      method: 'POST',
      body: JSON.stringify(tagData)
    });
  }

  // ========== USERS (if available) ==========

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<any> {
    return this.request('/rest/users/me');
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
}

// Export a factory function for creating configured instance
export async function createN8nService(): Promise<N8nService> {
  const service = new N8nService();
  await service.initialize();
  return service;
}
