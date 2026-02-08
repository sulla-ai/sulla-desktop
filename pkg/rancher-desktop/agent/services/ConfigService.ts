// ConfigService - Central configuration for agent services
// Reads settings from the main process via IPC

import Logging from '@pkg/utils/logging';

const console = Logging.agent;

// Type declarations for custom window properties
declare global {
  interface Window {
    __SULLA_CONFIG__?: any;
  }
}

const DEFAULT_MODEL = 'tinyllama:latest';
const OLLAMA_BASE = 'http://127.0.0.1:30114';

interface AgentConfig {
  ollamaModel: string;
  ollamaBase: string;
  soulPrompt: string;
  botName: string;
  primaryUserName: string;
  // LLM mode settings
  modelMode: 'local' | 'remote';
  // Local Ollama settings
  localTimeoutSeconds: number;
  localRetryCount: number;
  // Remote API settings
  remoteProvider: string;
  remoteModel: string;
  remoteApiKey: string;
  remoteBaseUrl: string;
  remoteRetryCount: number;
  remoteTimeoutSeconds: number;
  // Heartbeat settings
  heartbeatEnabled: boolean;
  heartbeatDelayMinutes: number;
  heartbeatPrompt: string;
  heartbeatModel: string;
}

let cachedConfig: AgentConfig | null = null;

// Config change listeners
type ConfigChangeListener = (newConfig: AgentConfig) => void;
const configListeners: ConfigChangeListener[] = [];

/**
 * Subscribe to configuration changes
 */
export function onConfigChange(listener: ConfigChangeListener): () => void {
  configListeners.push(listener);
  
  // Return unsubscribe function
  return () => {
    const index = configListeners.indexOf(listener);
    if (index > -1) {
      configListeners.splice(index, 1);
    }
  };
}

/**
 * Get the current agent configuration
 * In renderer process, this reads from window settings
 * In main process or when settings unavailable, uses defaults
 * 
 * This function will try multiple sources to ensure we get the most up-to-date config
 */
export function getAgentConfig(): AgentConfig {
  // Always try to get fresh config if window settings become available
  // This handles the case where services initialize before window.__SULLA_CONFIG__ is populated
  if (typeof window !== 'undefined' && window.__SULLA_CONFIG__ && !cachedConfig) {
    console.log('[ConfigService] Window config became available, loading fresh config...');
    console.log('[ConfigService] window.__SULLA_CONFIG__:', window.__SULLA_CONFIG__);
    // Force a fresh load since window config just became available
  }

  if (cachedConfig) {
    // Quick check: if window config became available after we cached defaults, refresh
    if (typeof window !== 'undefined' && window.__SULLA_CONFIG__ && 
        cachedConfig.modelMode === 'local' && cachedConfig.remoteApiKey === '') {
      console.log('[ConfigService] Detected window config available but cached defaults, refreshing...');
      console.log('[ConfigService] window.__SULLA_CONFIG__:', window.__SULLA_CONFIG__);
      cachedConfig = null;
    } else {
      return cachedConfig;
    }
  }

  console.log('[ConfigService] Loading fresh config...');

  // Try to read from global settings if available
  try {
    // Check if we're in a context where settings are available
    console.log('[ConfigService] Checking window.__SULLA_CONFIG__...');
    console.log('[ConfigService] typeof window:', typeof window);
    console.log('[ConfigService] window exists:', typeof window !== 'undefined');
    console.log('[ConfigService] window.__SULLA_CONFIG__ exists:', !!(window as any).__SULLA_CONFIG__);
    
    if (typeof window !== 'undefined' && window.__SULLA_CONFIG__) {
      const config = window.__SULLA_CONFIG__;
      console.log('[ConfigService] Found window config:', config);

      cachedConfig = {
        ollamaModel:      config.sullaModel || DEFAULT_MODEL,
        ollamaBase:       OLLAMA_BASE,
        soulPrompt:       config.soulPrompt || '',
        botName:          config.botName || 'Sulla',
        primaryUserName:  config.primaryUserName || '',
        modelMode:        config.modelMode || 'local',
        localTimeoutSeconds: config.localTimeoutSeconds ?? 120,
        localRetryCount: config.localRetryCount ?? 2,
        remoteProvider:   config.remoteProvider || 'grok',
        remoteModel:      config.remoteModel || 'grok-4-1-fast-reasoning',
        remoteApiKey:     config.remoteApiKey || '',
        remoteBaseUrl:    config.remoteBaseUrl || 'https://api.x.ai/v1',
        remoteRetryCount: config.remoteRetryCount ?? 3,
        remoteTimeoutSeconds: config.remoteTimeoutSeconds ?? 60,
        heartbeatEnabled: config.heartbeatEnabled ?? true,
        heartbeatDelayMinutes: config.heartbeatDelayMinutes ?? 30,
        heartbeatPrompt: config.heartbeatPrompt || '',
        heartbeatModel: config.heartbeatModel || 'default',
      };

      console.log('[ConfigService] Loaded from window config:', cachedConfig);
      return cachedConfig;
    }

    console.log('[ConfigService] Window config not available, trying main process...');

    // If we're in the main process, we should have direct access to cfg
    // But if not, try IPC as fallback
    if (typeof window === 'undefined') {
      console.log('[ConfigService] In main process, trying direct settings access...');
      try {
        // Try to access cfg directly if we're in main process context
        const mainModule = require('@pkg/config/settingsImpl');
        if (mainModule && typeof mainModule.getSettings === 'function') {
          const settings = mainModule.getSettings();
          console.log('[ConfigService] Main process settings:', settings);
          if (settings && settings.experimental) {
            const config = settings.experimental;
            cachedConfig = {
              ollamaModel:      config.sullaModel || DEFAULT_MODEL,
              ollamaBase:       OLLAMA_BASE,
              soulPrompt:       config.soulPrompt || '',
              botName:          config.botName || 'Sulla',
              primaryUserName:  config.primaryUserName || '',
              modelMode:        config.modelMode || 'local',
              localTimeoutSeconds: config.localTimeoutSeconds ?? 120,
              localRetryCount: config.localRetryCount ?? 2,
              remoteProvider:   config.remoteProvider || 'grok',
              remoteModel:      config.remoteModel || 'grok-4-1-fast-reasoning',
              remoteApiKey:     config.remoteApiKey || '',
              remoteBaseUrl:    config.remoteBaseUrl || 'https://api.x.ai/v1',
              remoteRetryCount: config.remoteRetryCount ?? 3,
              remoteTimeoutSeconds: config.remoteTimeoutSeconds ?? 60,
              heartbeatEnabled: config.heartbeatEnabled ?? true,
              heartbeatDelayMinutes: config.heartbeatDelayMinutes ?? 30,
              heartbeatPrompt: config.heartbeatPrompt || '',
              heartbeatModel: config.heartbeatModel || 'default',
            };

            console.log('[ConfigService] Loaded from main process settings:', cachedConfig);
            return cachedConfig;
          }
        }
      } catch (err) {
        console.warn('[ConfigService] Failed to access settings directly:', err);
      }
    }

    console.log('[ConfigService] No settings found, using defaults...');
  } catch (err) {
    console.warn('[ConfigService] Error loading config:', err);
  }

  // Return defaults
  cachedConfig = {
    ollamaModel:      DEFAULT_MODEL,
    ollamaBase:       OLLAMA_BASE,
    soulPrompt:       '',
    botName:          'Sulla',
    primaryUserName:  '',
    modelMode:        'local',
    localTimeoutSeconds: 120,
    localRetryCount: 2,
    remoteProvider:   'grok',
    remoteModel:      'grok-4-1-fast-reasoning',
    remoteApiKey:     '',
    remoteBaseUrl:    'https://api.x.ai/v1',
    remoteRetryCount: 3,
    remoteTimeoutSeconds: 60,
    heartbeatEnabled: true,
    heartbeatDelayMinutes: 30,
    heartbeatPrompt: '',
    heartbeatModel: 'default',
  };

  console.log('[ConfigService] Using defaults:', cachedConfig);
  return cachedConfig;
}

/**
 * Update the cached configuration with full settings
 * Called when settings change
 */
export function updateAgentConfigFull(settings: {
  sullaModel?: string;
  soulPrompt?: string;
  botName?: string;
  primaryUserName?: string;
  modelMode?: 'local' | 'remote';
  localTimeoutSeconds?: number;
  localRetryCount?: number;
  remoteProvider?: string;
  remoteModel?: string;
  remoteApiKey?: string;
  remoteBaseUrl?: string;
  remoteRetryCount?: number;
  remoteTimeoutSeconds?: number;
  heartbeatEnabled?: boolean;
  heartbeatDelayMinutes?: number;
  heartbeatPrompt?: string;
  heartbeatModel?: string;
}): void {
  // Clear cache first to force refresh
  cachedConfig = null;
  
  cachedConfig = {
    ollamaModel:      settings.sullaModel || DEFAULT_MODEL,
    ollamaBase:       OLLAMA_BASE,
    soulPrompt:       settings.soulPrompt || '',
    botName:          settings.botName || 'Sulla',
    primaryUserName:  settings.primaryUserName || '',
    modelMode:        settings.modelMode || 'local',
    localTimeoutSeconds: settings.localTimeoutSeconds ?? 120,
    localRetryCount: settings.localRetryCount ?? 2,
    remoteProvider:   settings.remoteProvider || 'grok',
    remoteModel:      settings.remoteModel || 'grok-4-1-fast-reasoning',
    remoteApiKey:     settings.remoteApiKey || '',
    remoteBaseUrl:    settings.remoteBaseUrl || 'https://api.x.ai/v1',
    remoteRetryCount: settings.remoteRetryCount ?? 3,
    remoteTimeoutSeconds: settings.remoteTimeoutSeconds ?? 60,
    heartbeatEnabled: settings.heartbeatEnabled ?? true,
    heartbeatDelayMinutes: settings.heartbeatDelayMinutes ?? 30,
    heartbeatPrompt: settings.heartbeatPrompt || '',
    heartbeatModel: settings.heartbeatModel || 'default',
  };

  // Notify all listeners of the config change
  configListeners.forEach(listener => {
    try {
      listener(cachedConfig!);
    } catch (error) {
      console.error('[ConfigService] Error notifying config listener:', error);
    }
  });

  // LLMRegistry now pulls configuration from ConfigService on demand

  // If we're in renderer process, notify main process of config change
  if (typeof window !== 'undefined') {
    try {
      const { ipcRenderer } = require('@pkg/utils/ipcRenderer');
      ipcRenderer.send('agent-config-updated', cachedConfig);
    } catch (err) {
      console.warn('[ConfigService] Failed to notify main process of config change:', err);
    }
  }

  console.log(`[ConfigService] Config updated and ${configListeners.length} listeners notified: mode=${cachedConfig.modelMode}, model=${cachedConfig.modelMode === 'local' ? cachedConfig.ollamaModel : cachedConfig.remoteModel}, retries=${cachedConfig.remoteRetryCount}, timeoutSeconds=${cachedConfig.remoteTimeoutSeconds}, heartbeat=${cachedConfig.heartbeatEnabled ? `${cachedConfig.heartbeatDelayMinutes}min` : 'disabled'}`);
}

/**
 * Update the cached configuration (legacy - just model)
 * Called when settings change
 */
/**
 * Force refresh the cached configuration by clearing cache
 * Call this when you suspect settings may have changed
 */
export function refreshAgentConfig(): void {
  console.log('[ConfigService] Forcing config refresh...');
  cachedConfig = null;
  // Next call to getAgentConfig() will reload from sources
  const fresh = getAgentConfig();
  console.log('[ConfigService] Refreshed config:', fresh);
}

/**
 * Get the configured Ollama model
 */
export function getOllamaModel(): string {
  return getAgentConfig().ollamaModel;
}

/**
 * Get the Ollama base URL
 */
export function getOllamaBase(): string {
  return getAgentConfig().ollamaBase;
}

/**
 * Get the current model mode
 */
export function getModelMode(): 'local' | 'remote' {
  return getAgentConfig().modelMode;
}

/**
 * Get remote provider settings
 */
export function getRemoteConfig(): { provider: string; model: string; apiKey: string; baseUrl: string } {
  const config = getAgentConfig();

  return {
    provider: config.remoteProvider,
    model:    config.remoteModel,
    apiKey:   config.remoteApiKey,
    baseUrl:  config.remoteBaseUrl,
  };
}

/**
 * Get local Ollama settings
 */
export function getLocalConfig(): { timeoutSeconds: number; retryCount: number } {
  const config = getAgentConfig();

  return {
    timeoutSeconds: config.localTimeoutSeconds,
    retryCount:     config.localRetryCount,
  };
}

export { DEFAULT_MODEL, OLLAMA_BASE };
