/**
 * LLM Registry - Central access point for LLM services
 *
 * Provides:
 * - getLLMService('local' | 'remote' | modelName)
 * - getLocalService() / getRemoteService()
 * - getLocalModel() / getRemoteModel()
 * - getHeartbeatLLM() — respects heartbeatModel → modelMode fallback
 *
 * Pulls configuration from ConfigService on demand.
 * All services lazy-init / reconfigure on demand.
 */

import { BaseLanguageModel, type LLMConfig, type RemoteProviderConfig } from './BaseLanguageModel';
import { OllamaService, getOllamaService } from './OllamaService';
import { createRemoteModelService } from './RemoteService';
import { getAgentConfig, onConfigChange } from '../services/ConfigService';

class LLMRegistryImpl {
  private services = new Map<string, BaseLanguageModel>();
  private configs = new Map<string, LLMConfig>();
  private currentConfig: LLMConfig | null = null;

  constructor() {
    // Subscribe to config changes to clear caches when settings change
    onConfigChange((newConfig) => {
      console.log('[LLMRegistry] Configuration changed, clearing service caches...');
      console.log('[LLMRegistry] New config mode:', newConfig.modelMode, 'provider:', newConfig.remoteProvider);
      this.clearCaches();
    });
  }

  private clearCaches(): void {
    this.services.clear();
    this.configs.clear();
    this.currentConfig = null;
    console.log('[LLMRegistry] Service and config caches cleared');
  }

  /**
   * Pull latest configuration from ConfigService
   */
  private pullConfig(): LLMConfig {
    const agentConfig = getAgentConfig();
    const config: LLMConfig = {
      mode: agentConfig.modelMode,
      localModel: agentConfig.ollamaModel,
      ollamaBase: agentConfig.ollamaBase,
      localTimeoutSeconds: agentConfig.localTimeoutSeconds,
      localRetryCount: agentConfig.localRetryCount,
      remoteProvider: agentConfig.remoteProvider,
      remoteModel: agentConfig.remoteModel,
      remoteApiKey: agentConfig.remoteApiKey,
      remoteBaseUrl: agentConfig.remoteBaseUrl,
      remoteRetryCount: agentConfig.remoteRetryCount,
      remoteTimeoutSeconds: agentConfig.remoteTimeoutSeconds,
      heartbeatModel: agentConfig.heartbeatModel as 'default' | 'local' | 'remote',
    };

    this.currentConfig = { ...config };
    this.configs.set('global', { ...config });

    console.log(`[LLMRegistry] Config pulled → mode=${config.mode}, local=${config.localModel}, remote=${config.remoteModel || 'n/a'}`);
    return config;
  }

  /**
   * Refresh configuration from ConfigService
   */
  refreshConfig(): void {
    this.pullConfig();
  }

  /**
   * Get service by mode or model name
   */
  getService(specifier: 'local' | 'remote' | string): BaseLanguageModel {
    if (specifier === 'local') return this.getLocalService();
    if (specifier === 'remote') return this.getRemoteService();

    // By model name
    if (this.isLikelyLocalModel(specifier)) {
      return this.getLocalService(specifier);
    }
    return this.getRemoteService(specifier);
  }

  getLocalService(overrideModel?: string): BaseLanguageModel {
    const key = 'local';
    let svc = this.services.get(key);

    const cfg = this.currentConfig || this.pullConfig();
    const desiredModel = overrideModel || cfg.localModel;

    if (!svc || svc.getModel() !== desiredModel) {
      svc = getOllamaService();
      if (overrideModel) {
        // Ollama singleton — can't change model easily, but we expose it
        console.warn('[LLMRegistry] Local model override requested — using global Ollama instance');
      }
      this.services.set(key, svc);
      svc.initialize().catch(console.error);
    }

    return svc;
  }

  getRemoteService(overrideModel?: string): BaseLanguageModel {
    const key = 'remote';
    let svc = this.services.get(key);

    const cfg = this.currentConfig || this.pullConfig();
    const desiredModel = overrideModel || cfg.remoteModel;

    if (!svc || svc.getModel() !== desiredModel) {
      const remoteCfg: RemoteProviderConfig = {
        id: cfg.remoteProvider || 'grok',
        name: cfg.remoteProvider || 'Grok',
        baseUrl: this.getProviderBaseUrl(cfg.remoteProvider),
        apiKey: cfg.remoteApiKey || '',
        model: desiredModel || 'unknown',
      };

      svc = createRemoteModelService(remoteCfg);

      if (cfg.remoteRetryCount !== undefined) {
        (svc as any).setRetryCount?.(cfg.remoteRetryCount);
      }
      if (cfg.remoteTimeoutSeconds !== undefined) {
        (svc as any).setDefaultTimeoutMs?.(cfg.remoteTimeoutSeconds * 1000);
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
  getHeartbeatLLM(): BaseLanguageModel {
    const cfg = this.currentConfig || this.pullConfig();
    const hb = (cfg.heartbeatModel || 'default') as 'default' | 'local' | 'remote';

    if (hb === 'local')    return this.getLocalService();
    if (hb === 'remote')   return this.getRemoteService();
    return this.getService(cfg.mode); // default → modelMode
  }

  getLocalModel(): string {
    return (this.currentConfig || this.pullConfig()).localModel;
  }

  getRemoteModel(): string {
    return (this.currentConfig || this.pullConfig()).remoteModel || 'unknown';
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

  private getDefaultConfig(): LLMConfig {
    return {
      mode: 'local',
      localModel: 'llama3.2:1b',
      ollamaBase: 'http://127.0.0.1:11434',
      remoteProvider: 'grok',
      remoteModel: 'grok-beta',
      remoteApiKey: '',
      localTimeoutSeconds: 120,
      remoteTimeoutSeconds: 60,
      remoteRetryCount: 0,
      heartbeatModel: 'default',
      // ... extend with other defaults
    };
  }

  getCurrentModel(): string {
    const cfg = this.currentConfig || this.pullConfig();
    if (cfg.mode === 'remote') {
      return this.getRemoteModel();
    }
    return cfg.localModel || this.getDefaultConfig().localModel;
  }

  getCurrentMode(): 'local' | 'remote' {
    return (this.currentConfig || this.pullConfig()).mode || 'local';
  }

  getCurrentConfig(): any {
    return this.currentConfig || this.pullConfig();
  }

  /**
   * Add this method to LLMRegistryImpl for explicit control
   * 
   * @param context 'local' | 'remote'
   * @param model Specific model name (optional override)
   * @returns Service instance
   */
  getServiceForContext(context: 'local' | 'remote', model?: string): BaseLanguageModel {
    if (context === 'local') {
      return this.getLocalService(model);
    }
    return this.getRemoteService(model);
  }
}

export const LLMRegistry = new LLMRegistryImpl();

export const getLLMService     = (spec: 'local' | 'remote' | string) => LLMRegistry.getService(spec);
export const getLocalService   = (model?: string) => LLMRegistry.getLocalService(model);
export const getRemoteService  = (model?: string) => LLMRegistry.getRemoteService(model);
export const getHeartbeatLLM   = () => LLMRegistry.getHeartbeatLLM();
export const getLocalModel     = () => LLMRegistry.getLocalModel();
export const getRemoteModel    = () => LLMRegistry.getRemoteModel();
export const getService = (context: 'local' | 'remote', model?: string) =>
  LLMRegistry.getServiceForContext(context, model);
export const getCurrentModel = () => LLMRegistry.getCurrentModel();
export const getCurrentMode = () => LLMRegistry.getCurrentMode();
export const getCurrentConfig = () => LLMRegistry.getCurrentConfig();