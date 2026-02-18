/**
 * LLM Registry - Central access point for LLM services
 *
 * Provides:
 * - getLLMService('local' | 'remote' | modelName)
 * - getLocalService() / getRemoteService()
 * - getLocalModel() / getRemoteModel()
 * - getHeartbeatLLM() — respects heartbeatModel → modelMode fallback
 *
 * Pulls configuration from SullaSettingsModel on demand.
 * All services lazy-init / reconfigure on demand.
 */

import { BaseLanguageModel, type RemoteProviderConfig } from './BaseLanguageModel';
import { getOllamaService } from './OllamaService';
import { createRemoteModelService } from './RemoteService';
import { SullaSettingsModel } from '../database/models/SullaSettingsModel';
import { modelDiscoveryService, type ModelInfo } from './ModelDiscoveryService';

class LLMRegistryImpl {
  private services = new Map<string, BaseLanguageModel>();

  /**
   * Get service by mode or model name
   */
  async getService(specifier: 'local' | 'remote' | string): Promise<BaseLanguageModel> {
    if (specifier === 'local') return this.getLocalService();
    if (specifier === 'remote') return this.getRemoteService();

    // By model name
    if (this.isLikelyLocalModel(specifier)) {
      return this.getLocalService(specifier);
    }
    return this.getRemoteService(specifier);
  }

  async getLocalService(overrideModel?: string): Promise<BaseLanguageModel> {
    const key = 'local';
    let svc = this.services.get(key);

    const desiredModel = overrideModel || await SullaSettingsModel.get('sullaModel', 'tinyllama:latest');

    if (!svc || svc.getModel() !== desiredModel) {
      svc = await getOllamaService();
      if (overrideModel) {
        // Ollama singleton — can't change model easily, but we expose it
        console.warn('[LLMRegistry] Local model override requested — using global Ollama instance');
      }
      this.services.set(key, svc);
      svc.initialize().catch(console.error);
    }

    return svc;
  }

  async getRemoteService(overrideModel?: string): Promise<BaseLanguageModel> {
    const key = 'remote';
    let svc = this.services.get(key);

    // Load settings directly
    const remoteProvider = await SullaSettingsModel.get('remoteProvider', 'grok');
    const remoteModel = overrideModel || await SullaSettingsModel.get('remoteModel', 'grok-4-1-fast-reasoning');
    const remoteApiKey = await SullaSettingsModel.get('remoteApiKey', '');
    const remoteTimeoutSeconds = await SullaSettingsModel.get('remoteTimeoutSeconds', 60);
    const remoteRetryCount = await SullaSettingsModel.get('remoteRetryCount', 3);

    if (!svc || svc.getModel() !== remoteModel) {
      const remoteCfg: RemoteProviderConfig = {
        id: remoteProvider,
        name: remoteProvider,
        baseUrl: this.getProviderBaseUrl(remoteProvider),
        apiKey: remoteApiKey,
        model: remoteModel,
      };

      svc = createRemoteModelService(remoteCfg);

      if (remoteRetryCount !== undefined) {
        (svc as any).setRetryCount?.(remoteRetryCount);
      }
      if (remoteTimeoutSeconds !== undefined) {
        (svc as any).setDefaultTimeoutMs?.(remoteTimeoutSeconds * 1000);
      }

      this.services.set(key, svc);
      svc.initialize().catch(console.error);
    }

    return svc;
  }

  /**
   * Backend/heartbeat-aware service
   * Uses heartbeatModel → falls back to modelMode
   */
  async getHeartbeatLLM(): Promise<BaseLanguageModel> {
    const heartbeatModel = await SullaSettingsModel.get('heartbeatModel', 'default');
    const mode = await SullaSettingsModel.get('modelMode', 'local');

    if (heartbeatModel === 'local')    return this.getLocalService();
    if (heartbeatModel === 'remote')   return this.getRemoteService();
    return this.getService(mode); // default → modelMode
  }

  getLocalModel(): Promise<string> {
    return SullaSettingsModel.get('sullaModel', 'tinyllama:latest');
  }

  getRemoteModel(): Promise<string> {
    return SullaSettingsModel.get('remoteModel', 'grok-4-1-fast-reasoning');
  }

  private isLikelyLocalModel(name: string): boolean {
    return (
      name.includes(':') ||
      !!name.match(/^\d+b$/) ||
      /^(llama|phi|qwen|gemma|mistral|deepseek|ollama)/i.test(name)
    );
  }

  private getProviderBaseUrl(id: string = 'grok'): string {
    const map: Record<string, string> = {
      grok:      'https://api.x.ai/v1',
      openai:    'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      google:    'https://generativelanguage.googleapis.com/v1beta',
      kimi:      'https://api.moonshot.cn/v1',
      nvidia:    'https://integrate.api.nvidia.com/v1',
    };
    return map[id] || map.grok;
  }

  async getCurrentModel(): Promise<string> {
    const mode = await SullaSettingsModel.get('modelMode', 'local');
    if (mode === 'remote') {
      return this.getRemoteModel();
    }
    return this.getLocalModel();
  }

  getCurrentMode(): Promise<'local' | 'remote'> {
    return SullaSettingsModel.get('modelMode', 'local');
  }

  async getCurrentConfig(): Promise<any> {
    return {
      mode: await SullaSettingsModel.get('modelMode', 'local'),
      localModel: await SullaSettingsModel.get('sullaModel', 'tinyllama:latest'),
      remoteModel: await SullaSettingsModel.get('remoteModel', 'grok-4-1-fast-reasoning'),
      remoteProvider: await SullaSettingsModel.get('remoteProvider', 'grok'),
      remoteApiKey: await SullaSettingsModel.get('remoteApiKey', ''),
    };
  }

  /**
   * Add this method to LLMRegistryImpl for explicit control
   * 
   * @param context 'local' | 'remote'
   * @param model Specific model name (optional override)
   * @returns Service instance
   */
  async getServiceForContext(context: 'local' | 'remote', model?: string): Promise<BaseLanguageModel> {
    if (context === 'local') {
      return this.getLocalService(model);
    }
    return this.getRemoteService(model);
  }

  // ============================================================================
  // DYNAMIC MODEL DISCOVERY
  // ============================================================================

  /**
   * Fetch available models for a specific provider
   * @param providerId Provider identifier (e.g., 'openai', 'anthropic')
   * @param apiKey API key for the provider
   * @returns Available models from the provider
   */
  async fetchModelsForProvider(providerId: string, apiKey?: string): Promise<ModelInfo[]> {
    const key = apiKey || await SullaSettingsModel.get('remoteApiKey', '');
    if (!key) {
      throw new Error(`No API key configured for provider: ${providerId}`);
    }
    
    return await modelDiscoveryService.fetchModelsForProvider(providerId, key);
  }

  /**
   * Fetch available models from all configured providers
   * @returns All available models from configured providers
   */
  async fetchAllAvailableModels(): Promise<ModelInfo[]> {
    const providers: Record<string, string> = {};
    
    // Get API keys for all supported providers
    const supportedProviders = modelDiscoveryService.getSupportedProviders();
    
    for (const providerId of supportedProviders) {
      // Try to get API key for each provider
      try {
        let apiKey = '';
        
        if (providerId === 'openai') {
          apiKey = await SullaSettingsModel.get('openaiApiKey', '');
        } else if (providerId === 'anthropic') {
          apiKey = await SullaSettingsModel.get('anthropicApiKey', '');
        } else if (providerId === 'google') {
          apiKey = await SullaSettingsModel.get('googleApiKey', '');
        } else if (providerId === 'grok') {
          apiKey = await SullaSettingsModel.get('grokApiKey', '');
        } else if (providerId === 'kimi') {
          apiKey = await SullaSettingsModel.get('kimiApiKey', '');
        } else if (providerId === 'nvidia') {
          apiKey = await SullaSettingsModel.get('nvidiaApiKey', '');
        } else {
          // Fallback to generic remoteApiKey for unknown providers
          const currentProvider = await SullaSettingsModel.get('remoteProvider', 'grok');
          if (currentProvider === providerId) {
            apiKey = await SullaSettingsModel.get('remoteApiKey', '');
          }
        }
        
        if (apiKey && apiKey.trim() !== '') {
          providers[providerId] = apiKey;
        }
      } catch (error) {
        console.warn(`[LLMRegistry] Failed to get API key for ${providerId}:`, error);
      }
    }
    
    return await modelDiscoveryService.fetchAllAvailableModels(providers);
  }

  /**
   * Get currently configured remote models (for backwards compatibility)
   * @returns Array containing the current remote model
   */
  async getCurrentRemoteModels(): Promise<ModelInfo[]> {
    const remoteProvider = await SullaSettingsModel.get('remoteProvider', 'grok');
    const remoteModel = await SullaSettingsModel.get('remoteModel', 'grok-4-1-fast-reasoning');
    
    return [{
      id: remoteModel,
      name: remoteModel,
      provider: remoteProvider
    }];
  }

  /**
   * Clear model cache for dynamic discovery
   * @param providerId Optional provider to clear cache for (clears all if not provided)
   */
  clearModelCache(providerId?: string): void {
    modelDiscoveryService.clearCache(providerId);
  }

  /**
   * Get model cache statistics
   */
  getModelCacheStats(): { size: number; providers: string[] } {
    return modelDiscoveryService.getCacheStats();
  }

  /**
   * Get supported providers for dynamic model fetching
   */
  getSupportedProviders(): string[] {
    return modelDiscoveryService.getSupportedProviders();
  }
}

export const LLMRegistry = new LLMRegistryImpl();

export const getLLMService     = async (spec: 'local' | 'remote' | string) => await LLMRegistry.getService(spec);
export const getLocalService   = async (model?: string) => await LLMRegistry.getLocalService(model);
export const getRemoteService  = async (model?: string) => await LLMRegistry.getRemoteService(model);
export const getHeartbeatLLM   = async () => await LLMRegistry.getHeartbeatLLM();
export const getLocalModel     = async () => await LLMRegistry.getLocalModel();
export const getRemoteModel    = async () => await LLMRegistry.getRemoteModel();
export const getService = async (context: 'local' | 'remote', model?: string) =>
  await LLMRegistry.getServiceForContext(context, model);
export const getCurrentModel = async () => await LLMRegistry.getCurrentModel();
export const getCurrentMode = async () => await LLMRegistry.getCurrentMode();

// Dynamic model discovery exports
export const fetchModelsForProvider = async (providerId: string, apiKey?: string) => 
  await LLMRegistry.fetchModelsForProvider(providerId, apiKey);
export const fetchAllAvailableModels = async () => 
  await LLMRegistry.fetchAllAvailableModels();
export const getCurrentRemoteModels = async () => 
  await LLMRegistry.getCurrentRemoteModels();
export const clearModelCache = (providerId?: string) => 
  LLMRegistry.clearModelCache(providerId);
export const getModelCacheStats = () => 
  LLMRegistry.getModelCacheStats();
export const getSupportedProviders = () => 
  LLMRegistry.getSupportedProviders();

// Export ModelInfo type for external use
export type { ModelInfo };
export const getCurrentConfig = async () => await LLMRegistry.getCurrentConfig();