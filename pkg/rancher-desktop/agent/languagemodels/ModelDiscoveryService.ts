/**
 * Model Discovery Service
 * 
 * Dynamically fetches available models from LLM provider APIs
 * Supports: OpenAI, Anthropic, Google, Grok, Kimi, NVIDIA
 * Features: Caching, error handling, provider-specific endpoint mapping
 */

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities?: string[];
  contextLength?: number;
  pricing?: {
    input?: number;
    output?: number;
  };
}

interface ProviderConfig {
  baseUrl: string;
  modelsEndpoint: string;
  authHeader: string;
  parseResponse: (data: any) => ModelInfo[];
}

export class ModelDiscoveryService {
  private cache = new Map<string, { models: ModelInfo[]; timestamp: number }>();
  private readonly cacheTimeout = 30 * 60 * 1000; // 30 minutes

  private providers: Record<string, ProviderConfig> = {
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      modelsEndpoint: '/models',
      authHeader: 'Authorization',
      parseResponse: (data) => data.data?.map((model: any) => ({
        id: model.id,
        name: model.id,
        provider: 'openai',
        capabilities: model.capabilities,
      })) || []
    },
    
    anthropic: {
      baseUrl: 'https://api.anthropic.com/v1',
      modelsEndpoint: '/models',
      authHeader: 'x-api-key',
      parseResponse: (data) => {
        // Anthropic doesn't have a models endpoint yet, return known models
        return [
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', contextLength: 200000 },
          { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', contextLength: 200000 },
          { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic', contextLength: 200000 },
          { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'anthropic', contextLength: 200000 },
          { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic', contextLength: 200000 }
        ];
      }
    },
    
    google: {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      modelsEndpoint: '/models',
      authHeader: 'Authorization',
      parseResponse: (data) => data.models?.map((model: any) => ({
        id: model.name.replace('models/', ''),
        name: model.displayName || model.name,
        provider: 'google',
        capabilities: model.supportedGenerationMethods,
      })) || []
    },
    
    grok: {
      baseUrl: 'https://api.x.ai/v1',
      modelsEndpoint: '/models',
      authHeader: 'Authorization',
      parseResponse: (data) => data.data?.map((model: any) => ({
        id: model.id,
        name: model.id,
        provider: 'grok',
      })) || []
    },
    
    kimi: {
      baseUrl: 'https://api.moonshot.cn/v1',
      modelsEndpoint: '/models',
      authHeader: 'Authorization',
      parseResponse: (data) => data.data?.map((model: any) => ({
        id: model.id,
        name: model.id,
        provider: 'kimi',
      })) || []
    },
    
    nvidia: {
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      modelsEndpoint: '/models',
      authHeader: 'Authorization',
      parseResponse: (data) => data.data?.map((model: any) => ({
        id: model.id,
        name: model.id,
        provider: 'nvidia',
      })) || []
    }
  };

  /**
   * Fetch available models for a specific provider
   */
  async fetchModelsForProvider(providerId: string, apiKey: string): Promise<ModelInfo[]> {
    const cacheKey = `${providerId}-${apiKey.slice(-8)}`;
    const cached = this.cache.get(cacheKey);
    
    // Return cached results if still valid
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.models;
    }

    const provider = this.providers[providerId];
    if (!provider) {
      throw new Error(`Unsupported provider: ${providerId}`);
    }

    try {
      // Special handling for Anthropic (no models endpoint yet)
      if (providerId === 'anthropic') {
        const models = provider.parseResponse({});
        this.cache.set(cacheKey, { models, timestamp: Date.now() });
        return models;
      }

      const url = `${provider.baseUrl}${provider.modelsEndpoint}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Sulla-Desktop/1.0'
      };

      // Set auth header
      if (provider.authHeader === 'Authorization') {
        headers.Authorization = `Bearer ${apiKey}`;
      } else {
        headers[provider.authHeader] = apiKey;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(`Invalid API key for ${providerId}`);
        }
        if (response.status === 403) {
          throw new Error(`Access denied for ${providerId} models endpoint`);
        }
        throw new Error(`Failed to fetch models from ${providerId}: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const models = provider.parseResponse(data);
      
      // Cache the results
      this.cache.set(cacheKey, { models, timestamp: Date.now() });
      
      return models;
    } catch (error) {
      console.warn(`[ModelDiscovery] Failed to fetch models for ${providerId}:`, error);
      
      // Return cached results if available, even if expired
      if (cached) {
        return cached.models;
      }
      
      // Return empty array on complete failure
      return [];
    }
  }

  /**
   * Fetch models for all configured providers
   */
  async fetchAllAvailableModels(providers: Record<string, string>): Promise<ModelInfo[]> {
    const allModels: ModelInfo[] = [];
    
    const promises = Object.entries(providers).map(async ([providerId, apiKey]) => {
      if (!apiKey || apiKey.trim() === '') {
        return [];
      }
      
      try {
        return await this.fetchModelsForProvider(providerId, apiKey);
      } catch (error) {
        console.warn(`[ModelDiscovery] Skipping ${providerId}:`, error);
        return [];
      }
    });

    const results = await Promise.allSettled(promises);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allModels.push(...result.value);
      }
    }

    return allModels;
  }

  /**
   * Get supported providers
   */
  getSupportedProviders(): string[] {
    return Object.keys(this.providers);
  }

  /**
   * Clear cache for a specific provider or all providers
   */
  clearCache(providerId?: string): void {
    if (providerId) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${providerId}-`)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; providers: string[] } {
    return {
      size: this.cache.size,
      providers: Array.from(new Set(
        Array.from(this.cache.keys()).map(key => key.split('-')[0])
      ))
    };
  }
}

export const modelDiscoveryService = new ModelDiscoveryService();
export type { ModelInfo };
