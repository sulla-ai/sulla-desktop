<script lang="ts">
import { defineComponent } from 'vue';

import { ipcRenderer } from '@pkg/utils/ipcRenderer';
import { IpcRendererEvent } from 'electron';

// Import soul prompt from TypeScript file
import { soulPrompt } from '../agent/prompts/soul';
import { heartbeatPrompt } from '../agent/prompts/heartbeat';
import { N8nService } from '../agent/services/N8nService';
import { SullaSettingsModel } from '../agent/database/models/SullaSettingsModel';
import { randomUUID } from 'crypto';
import { REMOTE_PROVIDERS } from '../shared/remoteProviders';
import { getSupportedProviders, fetchModelsForProvider, clearModelCache } from '../agent/languagemodels';
import { getIntegrationService } from '../agent/services/IntegrationService';
import { integrations } from '../agent/integrations/catalog';
import PostHogTracker from '@pkg/components/PostHogTracker.vue';

// Nav items for the Language Model Settings sidebar
const navItems = [
  { id: 'overview', name: 'Overview' },
  { id: 'models', name: 'Models' },
  { id: 'soul', name: 'Soul' },
  { id: 'heartbeat', name: 'Heartbeat' },
  { id: 'database', name: 'Diagnostics' },
];

// Ollama models sorted by resource requirements (smallest to largest)
const OLLAMA_MODELS = [
  {
    name: 'qwen2:0.5b', displayName: 'Qwen2 0.5B', size: '377MB', minMemoryGB: 1, minCPUs: 1, description: 'Alibaba\'s compact Qwen2 model, very lightweight',
  },
  {
    name: 'qwen3:0.6b', displayName: 'Qwen3 ASR 0.6B', size: '400MB', minMemoryGB: 1, minCPUs: 1, description: 'Alibaba\'s Qwen3 ASR model, optimized for speech recognition tasks',
  },
  {
    name: 'qwen2:1.5b', displayName: 'Qwen2 1.5B', size: '934MB', minMemoryGB: 2, minCPUs: 2, description: 'Alibaba\'s Qwen2 model, efficient for basic tasks',
  },
  {
    name: 'phi3:mini', displayName: 'Phi-3 Mini', size: '2.2GB', minMemoryGB: 4, minCPUs: 2, description: 'Microsoft\'s efficient 3.8B model, great reasoning capabilities',
  },
  {
    name: 'gemma:2b', displayName: 'Gemma 2B', size: '1.7GB', minMemoryGB: 4, minCPUs: 2, description: 'Google\'s lightweight model, good general performance',
  },
  {
    name: 'llama3.2:1b', displayName: 'Llama 3.2 1B', size: '1.3GB', minMemoryGB: 4, minCPUs: 2, description: 'Meta\'s smallest Llama 3.2, efficient and capable',
  },
  {
    name: 'llama3.2:3b', displayName: 'Llama 3.2 3B', size: '2.0GB', minMemoryGB: 4, minCPUs: 2, description: 'Meta\'s compact Llama 3.2, balanced performance',
  },
  {
    name: 'mistral:7b', displayName: 'Mistral 7B', size: '4.1GB', minMemoryGB: 5, minCPUs: 2, description: 'Excellent 7B model, strong coding and reasoning',
  },
  {
    name: 'qwen2:7b', displayName: 'Qwen2 7B', size: '4.4GB', minMemoryGB: 5, minCPUs: 2, description: 'Alibaba\'s Qwen2 7B model, strong performance',
  },
  {
    name: 'llama3.1:8b', displayName: 'Llama 3.1 8B', size: '4.7GB', minMemoryGB: 6, minCPUs: 2, description: 'Meta\'s latest 8B model, excellent all-around performance',
  },
  {
    name: 'gemma:7b', displayName: 'Gemma 7B', size: '5.0GB', minMemoryGB: 6, minCPUs: 2, description: 'Google\'s larger model, improved capabilities',
  },
  {
    name: 'codellama:7b', displayName: 'Code Llama 7B', size: '3.8GB', minMemoryGB: 5, minCPUs: 2, description: 'Specialized for code generation and understanding',
  },
  {
    name: 'llama3.1:70b', displayName: 'Llama 3.1 70B', size: '40GB', minMemoryGB: 48, minCPUs: 8, description: 'Meta\'s flagship model, state-of-the-art performance',
  },
  {
    name: 'mixtral:8x7b', displayName: 'Mixtral 8x7B', size: '26GB', minMemoryGB: 32, minCPUs: 8, description: 'Mixture of experts, excellent quality and speed',
  },
  {
    name: 'deepseek-coder:33b', displayName: 'DeepSeek Coder 33B', size: '19GB', minMemoryGB: 24, minCPUs: 6, description: 'Advanced coding model, excellent for development',
  }
];

interface InstalledModel {
  name: string;
  size: number;
  modified_at: string;
  digest: string;
}

export default defineComponent({
  name: 'language-model-settings',

  data() {
    return {
      currentNav:       'overview' as string,
      navItems,
      // Overview dashboard metrics
      containerStats: {
        cpuPercent:    0,
        memoryUsage:   0,
        memoryLimit:   0,
        memoryPercent: 0,
        status:        'unknown' as string,
      },
      statsInterval:    null as ReturnType<typeof setInterval> | null,
      loadingStats:     false,
      // Which tab is being viewed (local or remote)
      viewingTab:       'local' as 'local' | 'remote',
      // Which mode is currently active (saved in settings)
      activeMode:       'local' as 'local' | 'remote',
      // Local model settings
      activeModel:      'qwen2:0.5b', // The currently saved/active local model
      pendingModel:     'qwen2:0.5b', // The model selected in dropdown
      installedModels:  [] as InstalledModel[],
      loadingModels:    false,
      downloadingModel: null as string | null,
      downloadProgress: 0,
      // Remote model settings
      remoteProviders:      REMOTE_PROVIDERS,
      selectedProvider:     'grok',
      selectedRemoteModel:  'grok-4-1-fast-reasoning',
      apiKey:               '',
      apiKeyVisible:        false,
      // Dynamic model loading
      dynamicModels:        {} as Record<string, Array<{id: string; name: string; description: string; pricing?: string}>>,
      loadingRemoteModels:  false,
      modelLoadError:       '' as string,
      remoteRetryCount:     3, // Number of retries before falling back to local LLM
      remoteTimeoutSeconds: 60, // Remote API timeout limit in seconds
      // Local Ollama settings
      localTimeoutSeconds:  120, // Local Ollama timeout limit in seconds
      localRetryCount:      2, // Number of retries for local Ollama
      // Ollama model status tracking
      modelStatuses: {} as Record<string, 'installed' | 'missing' | 'failed'>,
      checkingModelStatuses: false,
      // Heartbeat settings
      heartbeatEnabled:     true,
      heartbeatDelayMinutes: 30,
      heartbeatPrompt:      '',
      heartbeatModel:       'default' as string, // 'default' or specific model like 'local:tinyllama:latest' or 'remote:grok:grok-4-1-fast-reasoning'

      // Database test properties
      runningTests:         false,
      runningArticlesTests: false,
      runningSectionsTests: false,
      runningMigrations:    false,
      runningSeeders:       false,
      testResults:          [] as Array<{status: 'pass' | 'fail' | 'info', message: string}>,
      finalTestResult:      null as {success: boolean, message: string} | null,
      articlesTestResult:   null as {success: boolean, message: string, counts?: any} | null,
      sectionsTestResult:   null as {success: boolean, message: string, counts?: any} | null,

      // N8n service test properties
      runningN8nTest:       false,
      n8nTestResult:        null as {success: boolean, message: string, data?: any} | null,
      n8nUrl:               'http://127.0.0.1:30119',

      // Soul prompt settings
      soulPrompt: '',
      botName: 'Sulla',
      primaryUserName: '',

      // Default prompts for reset
      soulPromptDefault: soulPrompt,
      heartbeatPromptDefault: heartbeatPrompt,

      // Primary / Secondary provider selection
      primaryProvider:      'ollama' as string,
      secondaryProvider:    'ollama' as string,
      availableProviders:   [{ id: 'ollama', name: 'Ollama (Local)' }] as Array<{ id: string; name: string }>,

      // Activation state
      activating:           false,
      activationError:      '' as string,
      savingSettings:       false,

      // Guard flag to prevent feedback loop between primaryProvider watcher and IPC handler
      _suppressProviderWatch: false,
    };
  },

  computed: {
    currentNavItem(): { id: string; name: string } {
      const item = this.navItems.find(item => item.id === this.currentNav) || this.navItems[0];
      console.log('computed currentNavItem:', item, 'currentNav:', this.currentNav);
      return item;
    },
    soulPromptEditor: {
      get(): string {
        return this.soulPrompt;
      },
      set(val: string) {
        this.soulPrompt = String(val || '');
      },
    },
    heartbeatPromptEditor: {
      get(): string {
        return this.heartbeatPrompt;
      },
      set(val: string) {
        this.heartbeatPrompt = String(val || '');
      },
    },
    availableModels(): Array<{ name: string; displayName: string; size: string; description: string }> {
      return OLLAMA_MODELS;
    },
    pendingModelDescription(): string {
      const model = OLLAMA_MODELS.find(m => m.name === this.pendingModel);
      const desc = model?.description || '';
      console.log('computed pendingModelDescription:', desc, 'pendingModel:', this.pendingModel);
      return desc;
    },
    isPendingModelInstalled(): boolean {
      const installed = this.installedModels.some(m => m.name === this.pendingModel);
      console.log('computed isPendingModelInstalled:', installed, 'pendingModel:', this.pendingModel, 'installedModels:', this.installedModels.map(m => m.name));
      return installed;
    },
    isPendingDifferentFromActive(): boolean {
      return this.pendingModel !== this.activeModel;
    },
    formattedInstalledModels(): Array<InstalledModel & { formattedSize: string }> {
      return this.installedModels.map(model => ({
        ...model,
        formattedSize: this.formatBytes(model.size),
      }));
    },
    currentProvider(): typeof REMOTE_PROVIDERS[0] | undefined {
      return this.remoteProviders.find(p => p.id === this.selectedProvider);
    },
    currentProviderModels(): Array<{ id: string; name: string; description: string; pricing?: string }> {
      // Use dynamic models if available, fallback to static ones
      return this.dynamicModels[this.selectedProvider] || this.currentProvider?.models || [];
    },
    selectedRemoteModelDescription(): string {
      const model = this.currentProviderModels.find(m => m.id === this.selectedRemoteModel);

      return model?.description || '';
    },
    formattedMemoryUsage(): string {
      return this.formatBytes(this.containerStats.memoryUsage);
    },
    formattedMemoryLimit(): string {
      return this.formatBytes(this.containerStats.memoryLimit);
    },
    // Key model status getters
    embeddingModelStatus(): 'installed' | 'missing' | 'failed' {
      return this.modelStatuses['nomic-embed-text'] || 'missing';
    },
    defaultModelStatus(): 'installed' | 'missing' | 'failed' {
      const status = this.modelStatuses[this.activeModel] || 'missing';
      console.log('computed defaultModelStatus:', status, 'activeModel:', this.activeModel, 'modelStatuses:', this.modelStatuses);
      return status;
    },
    hasDownloadedModels(): boolean {
      return this.installedModels.length > 0;
    },
  },

  async mounted() {
    console.log('LanguageModelSettings mounted');
    // Listen for settings write errors from main process
    ipcRenderer.on('settings-write-error', (_event: unknown, error: any) => {
      console.error('[LM Settings] Settings write error from main process:', error);
      this.activationError = `Failed to save settings: ${error?.message || 'Unknown error'}`;
    });

    this.activeMode = await SullaSettingsModel.get('activeMode', 'local');

    // Listen for model changes from other windows
    ipcRenderer.on('model-changed', this.handleModelChanged);

    // Load all settings from database
    this.soulPrompt = await SullaSettingsModel.get('soulPrompt', soulPrompt);
    this.heartbeatPrompt = await SullaSettingsModel.get('heartbeatPrompt', heartbeatPrompt);
    this.heartbeatModel = await SullaSettingsModel.get('heartbeatModel', 'default');
    this.heartbeatDelayMinutes = await SullaSettingsModel.get('heartbeatDelayMinutes', 30);
    this.botName = await SullaSettingsModel.get('botName', 'Sulla');
    this.primaryUserName = await SullaSettingsModel.get('primaryUserName', '');
    this.activeMode = (await SullaSettingsModel.get('modelMode', 'local')) as 'local' | 'remote';
    // Strip quotes if present (in case of malformed storage)
    const mode = typeof this.activeMode === 'string' ? this.activeMode.replace(/^"|"$/g, '') : this.activeMode;
    this.activeMode = (mode === 'local' || mode === 'remote') ? mode : 'local';
    this.viewingTab = this.activeMode;
    this.selectedProvider = await SullaSettingsModel.get('remoteProvider', 'grok');
    this.selectedRemoteModel = await SullaSettingsModel.get('remoteModel', 'grok-4-1-fast-reasoning');
    this.apiKey = await SullaSettingsModel.get('remoteApiKey', '');
    this.remoteRetryCount = await SullaSettingsModel.get('remoteRetryCount', 3);
    this.remoteTimeoutSeconds = Number(await SullaSettingsModel.get('remoteTimeoutSeconds', 60));
    this.localTimeoutSeconds = await SullaSettingsModel.get('localTimeoutSeconds', 120);
    this.localRetryCount = await SullaSettingsModel.get('localRetryCount', 2);
    this.heartbeatEnabled = await SullaSettingsModel.get('heartbeatEnabled', true);
    // Load model from database
    this.activeModel = await SullaSettingsModel.get('sullaModel', 'tinyllama:latest');
    this.pendingModel = this.activeModel;

    console.log('Loaded settings values:', {
      activeMode: this.activeMode,
      viewingTab: this.viewingTab,
      selectedProvider: this.selectedProvider,
      selectedRemoteModel: this.selectedRemoteModel,
      remoteTimeoutSeconds: this.remoteTimeoutSeconds,
      localTimeoutSeconds: this.localTimeoutSeconds,
      remoteRetryCount: this.remoteRetryCount,
      localRetryCount: this.localRetryCount
    });

    // Load primary/secondary provider settings
    this.primaryProvider = await SullaSettingsModel.get('primaryProvider', 'ollama');
    this.secondaryProvider = await SullaSettingsModel.get('secondaryProvider', 'ollama');

    // Build available providers list from connected integrations
    try {
      const integrationService = getIntegrationService();
      await integrationService.initialize();

      const EXCLUDED_IDS = ['activepieces'];
      const providers: Array<{ id: string; name: string }> = [
        { id: 'ollama', name: 'Ollama (Local)' },
      ];

      for (const integration of Object.values(integrations)) {
        if (integration.category !== 'AI Infrastructure') continue;
        if (EXCLUDED_IDS.includes(integration.id)) continue;
        if (integration.id === 'ollama') continue;

        const connected = await integrationService.isAnyAccountConnected(integration.id);
        if (connected) {
          providers.push({ id: integration.id, name: integration.name });
        }
      }

      this.availableProviders = providers;
    } catch (err) {
      console.warn('[LM Settings] Failed to load available providers:', err);
    }

    await this.loadModels();
    
    // Load remote models if API key exists
    if (this.selectedProvider && this.apiKey.trim()) {
      await this.loadRemoteModels();
    }
    
    ipcRenderer.send('dialog/ready');
  },

  watch: {
    // Watch for API key changes to automatically load models
    async apiKey(newApiKey: string, oldApiKey: string) {
      if (newApiKey && newApiKey.trim() && newApiKey !== oldApiKey && this.selectedProvider) {
        await this.loadRemoteModels();
      }
    },
    
    // Watch for provider changes to automatically load models  
    async selectedProvider(newProvider: string, oldProvider: string) {
      if (newProvider && newProvider !== oldProvider && this.apiKey.trim()) {
        await this.loadRemoteModels();
      }
    },

    // Watch for primary provider changes — persist immediately and notify other windows
    async primaryProvider(newProvider: string, oldProvider: string) {
      if (!newProvider || newProvider === oldProvider) return;
      if (this._suppressProviderWatch) {
        this._suppressProviderWatch = false;
        return;
      }

      // Persist the new primary provider
      await SullaSettingsModel.set('primaryProvider', newProvider, 'string');

      // Read the preferred model for this provider from its integration settings
      let preferredModel = '';
      try {
        const integrationService = getIntegrationService();
        const formValues = await integrationService.getFormValues(newProvider);
        const modelVal = formValues.find((v: { property: string; value: string }) => v.property === 'model');
        preferredModel = modelVal?.value || '';
      } catch {
        // Fallback to legacy settings
        if (newProvider === 'ollama') {
          preferredModel = await SullaSettingsModel.get('sullaModel', '');
        } else {
          preferredModel = await SullaSettingsModel.get('remoteModel', '');
        }
      }

      // Keep legacy settings in sync
      if (newProvider === 'ollama') {
        await SullaSettingsModel.set('modelMode', 'local', 'string');
        if (preferredModel) {
          await SullaSettingsModel.set('sullaModel', preferredModel, 'string');
        }
        this.activeMode = 'local';
        this.viewingTab = 'local';
      } else {
        await SullaSettingsModel.set('modelMode', 'remote', 'string');
        await SullaSettingsModel.set('remoteProvider', newProvider, 'string');
        if (preferredModel) {
          await SullaSettingsModel.set('remoteModel', preferredModel, 'string');
        }
        this.activeMode = 'remote';
        this.viewingTab = 'remote';
        this.selectedProvider = newProvider;
        this.selectedRemoteModel = preferredModel;
      }

      // Notify other windows (Agent page model selector)
      ipcRenderer.send('model-changed',
        newProvider === 'ollama'
          ? { model: preferredModel, type: 'local' }
          : { model: preferredModel, type: 'remote', provider: newProvider },
      );
    }
  },

  beforeUnmount() {
    // Clean up IPC listeners
    ipcRenderer.removeAllListeners('settings-write-error');
    ipcRenderer.removeAllListeners('model-changed');
  },

  methods: {
    // Silent fetch that doesn't log network errors to console
    silentFetch(url: string, options: RequestInit = {}): Promise<Response | null> {
      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open(options.method || 'GET', url);

        // Set headers
        if (options.headers) {
          for (const [key, value] of Object.entries(options.headers)) {
            xhr.setRequestHeader(key, value as string);
          }
        }

        // Set timeout
        if (options.signal) {
          // For AbortSignal, we can't directly set timeout, but we can use a timer
          const timeoutId = setTimeout(() => {
            xhr.abort();
            resolve(null);
          }, 5000); // Default 5s timeout

          xhr.onload = () => {
            clearTimeout(timeoutId);
            // Convert XMLHttpRequest to Response-like object
            const response = {
              ok: xhr.status >= 200 && xhr.status < 300,
              status: xhr.status,
              statusText: xhr.statusText,
              text: () => Promise.resolve(xhr.responseText),
              json: () => Promise.resolve(JSON.parse(xhr.responseText || '{}')),
              body: null, // Not supported
            };
            resolve(response as any);
          };

          xhr.onerror = () => {
            clearTimeout(timeoutId);
            resolve(null);
          };

          xhr.ontimeout = () => {
            clearTimeout(timeoutId);
            resolve(null);
          };
        } else {
          xhr.timeout = 5000; // Default timeout
          xhr.onload = () => {
            const response = {
              ok: xhr.status >= 200 && xhr.status < 300,
              status: xhr.status,
              statusText: xhr.statusText,
              text: () => Promise.resolve(xhr.responseText),
              json: () => Promise.resolve(JSON.parse(xhr.responseText || '{}')),
              body: null,
            };
            resolve(response as any);
          };

          xhr.onerror = () => resolve(null);
          xhr.ontimeout = () => resolve(null);
        }

        // Send request
        if (options.body) {
          xhr.send(options.body as string);
        } else {
          xhr.send();
        }
      });
    },
    navClicked(navId: string) {
      console.log('navClicked called with navId:', navId, 'current viewingTab:', this.viewingTab);
      this.currentNav = navId;
      console.log('currentNav set to:', this.currentNav);
      if (navId === 'overview') {
        this.fetchContainerStats();
      } else if (navId === 'models') {
        this.loadModels();
        this.fetchContainerStats();
        this.checkModelStatuses();
        console.log('After models nav, viewingTab:', this.viewingTab);
      }
    },

    async fetchContainerStats() {
      try {
        // Query Ollama API for service status and running models
        const [tagsRes, psRes] = await Promise.all([
          this.silentFetch('http://127.0.0.1:30114/api/tags', { signal: AbortSignal.timeout(3000) }),
          this.silentFetch('http://127.0.0.1:30114/api/ps', { signal: AbortSignal.timeout(3000) }),
        ]);

        if (!tagsRes || !tagsRes.ok) {
          this.containerStats.status = 'offline';

          return;
        }

        this.containerStats.status = 'running';

        // Get running models info from /api/ps
        if (psRes && psRes.ok) {
          const psData = await psRes.json();
          const runningModels = psData.models || [];

          if (runningModels.length > 0) {
            // Sum up memory usage from all running models
            let totalSize = 0;
            let totalVramSize = 0;

            for (const model of runningModels) {
              totalSize += model.size || 0;
              totalVramSize += model.size_vram || 0;
            }

            // Use model size as memory indicator (actual VRAM/RAM used)
            this.containerStats.memoryUsage = totalVramSize || totalSize;
            // Estimate limit based on typical system (this is approximate)
            this.containerStats.memoryLimit = 16 * 1024 * 1024 * 1024; // 16GB default
            this.containerStats.memoryPercent = (this.containerStats.memoryUsage / this.containerStats.memoryLimit) * 100;

            // Store running model count for display
            (this.containerStats as Record<string, unknown>).runningModels = runningModels.length;
            (this.containerStats as Record<string, unknown>).modelDetails = runningModels.map((m: { name: string; size: number }) => ({
              name:  m.name,
              size:  m.size,
            }));
          } else {
            this.containerStats.memoryUsage = 0;
            this.containerStats.memoryPercent = 0;
            (this.containerStats as Record<string, unknown>).runningModels = 0;
            (this.containerStats as Record<string, unknown>).modelDetails = [];
          }
        }
      } catch (err) {
        console.warn('[LM Settings] Failed to fetch Ollama stats:', err);
        this.containerStats.status = 'error';
      }
    },

    formatBytes(bytes: number): string {
      if (bytes === 0) {
        return '0 B';
      }
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));

      return `${ parseFloat((bytes / Math.pow(k, i)).toFixed(1)) } ${ sizes[i] }`;
    },

    // Models tab methods
    async loadModels() {
      this.loadingModels = true;
      try {
        const res = await this.silentFetch('http://127.0.0.1:30114/api/tags', {
          signal: AbortSignal.timeout(5000),
        });

        if (res && res.ok) {
          const data = await res.json();

          this.installedModels = data.models || [];
        }
      } catch (err) {
        console.error('Failed to load models:', err);
      } finally {
        this.loadingModels = false;
      }
    },

    async downloadPendingModel() {
      await this.pullModel(this.pendingModel);
    },

    async pullModel(modelName: string) {
      this.downloadingModel = modelName;
      this.downloadProgress = 0;

      try {
        const res = await fetch('http://127.0.0.1:30114/api/pull', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ name: modelName, stream: true }),
        });

        if (!res.ok || !res.body) {
          console.error('Failed to download model:', res.status);

          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);

              if (data.total && data.completed) {
                this.downloadProgress = Math.round((data.completed / data.total) * 100);
              } else if (data.status === 'success') {
                this.downloadProgress = 100;
              }
            } catch {
              // Ignore parse errors for partial JSON
            }
          }
        }

        await this.loadModels();
        // After successful download, activate the model
        this.activateModel();
      } catch (err) {
        console.error('Error downloading model:', err);
      } finally {
        this.downloadingModel = null;
        this.downloadProgress = 0;
      }
    },

    async activateModel() {
      // Save the pending model as the active model
      this.activeModel = this.pendingModel;
      try {
        await SullaSettingsModel.set('sullaModel', this.pendingModel, 'string');
        console.log(`[LM Settings] Model activated: ${this.pendingModel}`);
      } catch (err) {
        console.error('Failed to save model setting:', err);
      }
    },

    // Remote model methods
    async onProviderChange() {
      // Clear current model selection
      this.selectedRemoteModel = '';
      
      // Load models for the new provider if we have an API key
      if (this.apiKey.trim()) {
        await this.loadRemoteModels();
      } else {
        // Use static fallback if no API key
        const provider = this.remoteProviders.find(p => p.id === this.selectedProvider);
        if (provider && provider.models.length > 0) {
          this.selectedRemoteModel = provider.models[0].id;
        }
      }
    },

    async loadRemoteModels() {
      if (!this.selectedProvider || !this.apiKey.trim()) {
        return;
      }

      this.loadingRemoteModels = true;
      this.modelLoadError = '';

      try {
        const modelList = await fetchModelsForProvider(this.selectedProvider, this.apiKey);
        
        // Transform models to match expected format
        const transformedModels = modelList.map(modelInfo => ({
          id: modelInfo.id,
          name: modelInfo.name,
          description: modelInfo.description || `${modelInfo.name} model`,
          pricing: modelInfo.pricing ? 
            `Input: $${modelInfo.pricing.input || 0}/1M tokens, Output: $${modelInfo.pricing.output || 0}/1M tokens` : 
            undefined
        }));

        this.dynamicModels[this.selectedProvider] = transformedModels;

        // Auto-select first model if none selected
        if (transformedModels.length > 0 && (!this.selectedRemoteModel || !transformedModels.find(m => m.id === this.selectedRemoteModel))) {
          this.selectedRemoteModel = transformedModels[0].id;
        }
      } catch (error) {
        this.modelLoadError = `Failed to load models: ${error instanceof Error ? error.message : String(error)}`;
        console.error('[LM Settings] Failed to load remote models:', error);
        
        // Fallback to static models on error
        const provider = this.remoteProviders.find(p => p.id === this.selectedProvider);
        if (provider && provider.models.length > 0 && !this.selectedRemoteModel) {
          this.selectedRemoteModel = provider.models[0].id;
        }
      } finally {
        this.loadingRemoteModels = false;
      }
    },

    async refreshRemoteModels() {
      if (!this.selectedProvider || !this.apiKey.trim()) {
        return;
      }

      try {
        // Clear the cache for this provider
        clearModelCache(this.selectedProvider);
        
        // Clear current models and reload
        this.dynamicModels[this.selectedProvider] = [];
        this.selectedRemoteModel = '';
        
        // Force reload models from API
        await this.loadRemoteModels();
      } catch (error) {
        this.modelLoadError = `Failed to refresh models: ${error instanceof Error ? error.message : String(error)}`;
        console.error('[LM Settings] Model refresh failed:', error);
      }
    },

    async activateLocalModel() {
      this.activating = true;
      this.activationError = '';

      try {
        // Check if Ollama is running
        const ollamaRes = await this.silentFetch('http://127.0.0.1:30114/api/tags', {
          signal: AbortSignal.timeout(5000),
        });

        if (!ollamaRes || !ollamaRes.ok) {
          this.activationError = 'Cannot connect to Ollama. Make sure the service is running.';

          return;
        }

        // Check if selected model is installed
        if (!this.isPendingModelInstalled) {
          this.activationError = `Model "${this.pendingModel}" is not installed. Please download it first.`;

          return;
        }

        // Save settings
        await this.writeExperimentalSettings({ modelMode: 'local' });

        this.activeMode = 'local';
        this.viewingTab = 'local';
        console.log('Activated local model, activeMode and viewingTab set to local');
        this.activeModel = this.pendingModel;
        console.log(`[LM Settings] Local model activated: ${this.pendingModel}`);

        // Emit event for other windows to update
        ipcRenderer.send('model-changed', { model: this.pendingModel, type: 'local' });
      } catch (err) {
        this.activationError = 'Failed to connect to Ollama. Is the service running?';
        console.error('Failed to activate local model:', err);
      } finally {
        this.activating = false;
      }
    },

    async activateRemoteModel() {
      this.activating = true;
      this.activationError = '';

      try {
        // Validate API key
        if (!this.apiKey.trim()) {
          this.activationError = 'Please enter an API key.';

          return;
        }

        // Test connection to remote API
        const provider = this.currentProvider;

        if (!provider) {
          this.activationError = 'Invalid provider selected.';

          return;
        }

        // Try a simple API call to validate the key
        const timeoutMs = Math.max(1000, Math.min(300, this.remoteTimeoutSeconds)) * 1000;

        if (provider.id === 'grok' || provider.id === 'openai' || provider.id === 'kimi' || provider.id === 'nvidia') {
          const testUrl = `${provider.baseUrl}/chat/completions`;
          const testBody = {
            model:       this.selectedRemoteModel,
            messages:    [{ role: 'user', content: 'Reply with the word: OK' }],
            temperature: 0,
            max_tokens:  10,
          };

          console.log('[Remote Test] Provider:', provider.id);
          console.log('[Remote Test] URL:', testUrl);
          console.log('[Remote Test] Model:', this.selectedRemoteModel);
          console.log('[Remote Test] API Key starts with:', this.apiKey.substring(0, 10) + '...');

          try {
            const testRes = await fetch(testUrl, {
              method:  'POST',
              headers: {
                'Content-Type':  'application/json',
                Authorization:   `Bearer ${this.apiKey}`,
              },
              body:    JSON.stringify(testBody),
              signal:  AbortSignal.timeout(timeoutMs),
            });

            if (!testRes.ok) {
              const errorText = await testRes.text();
              console.error('[Remote Test] Error response:', testRes.status, errorText);

              this.activationError = `Remote model test failed: ${testRes.status}. Check model, key, and timeout.`;
              console.error('Remote model test error:', errorText);

              return;
            }
          } catch (err) {
            this.activationError = 'Remote model test failed (timeout/network). Check connection, API key, and timeout.';
            console.error('Remote model test error:', err);

            return;
          }
        } else if (provider.id === 'anthropic') {
          const testUrl = `${provider.baseUrl}/messages`;
          const testBody = {
            model: this.selectedRemoteModel,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Reply with the word: OK' }]
          };

          console.log('[Remote Test] Provider:', provider.id);
          console.log('[Remote Test] URL:', testUrl);
          console.log('[Remote Test] Model:', this.selectedRemoteModel);
          console.log('[Remote Test] API Key starts with:', this.apiKey.substring(0, 10) + '...');

          try {
            const testRes = await fetch(testUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify(testBody),
              signal: AbortSignal.timeout(timeoutMs),
            });

            if (!testRes.ok) {
              const errorText = await testRes.text();
              console.error('[Remote Test] Error response:', testRes.status, errorText);

              this.activationError = `Remote model test failed: ${testRes.status}. Check model, key, and timeout.`;
              console.error('Remote model test error:', errorText);

              return;
            }
          } catch (err) {
            this.activationError = 'Remote model test failed (timeout/network). Check connection, API key, and timeout.';
            console.error('Remote model test error:', err);

            return;
          }
        } else {
          this.activationError = 'Remote provider test is not supported for this provider yet.';

          return;
        }

        // Save settings
        await this.writeExperimentalSettings({ modelMode: 'remote' });

        this.activeMode = 'remote';
        this.viewingTab = 'remote';
        console.log('Activated remote model, activeMode and viewingTab set to remote');
        this.activeModel = this.pendingModel;
        console.log(`[LM Settings] Remote model activated: ${this.selectedProvider}/${this.selectedRemoteModel}`);

        // Emit event for other windows to update
        ipcRenderer.send('model-changed', { model: this.selectedRemoteModel, type: 'remote', provider: this.selectedProvider });
      } catch (err) {
        this.activationError = 'Failed to save remote settings.';
        console.error('Failed to activate remote model:', err);
      } finally {
        this.activating = false;
      }
    },

    async checkModelStatuses() {
      this.checkingModelStatuses = true;
      try {
        // Ollama availability already checked in loadModels(), proceed with model checks
        
        // Check status of key models by checking against installed models list
        const keyModels = ['nomic-embed-text', this.activeModel].filter((model, index, arr) => arr.indexOf(model) === index);
        
        for (const modelName of keyModels) {
          try {
            // Check if model is in the installed models list from /api/tags
            const isInstalled = this.installedModels.some(model => model.name === modelName);
            this.modelStatuses[modelName] = isInstalled ? 'installed' : 'missing';
          } catch (error) {
            // Silently handle errors - don't log or break the interface
            this.modelStatuses[modelName] = 'failed';
          }
        }
      } catch (error) {
        // If the entire loop fails, silently continue
      } finally {
        this.checkingModelStatuses = false;
      }
    },

    async redownloadModel(modelName: string) {
      await this.pullModel(modelName);
      // Re-check statuses after download
      await this.checkModelStatuses();
    },

    async redownloadEmbeddingModel() {
      await this.redownloadModel('nomic-embed-text');
    },

    async redownloadDefaultModel() {
      await this.redownloadModel(this.activeModel);
    },

    async saveSettings() {
      if (this.savingSettings) {
        return;
      }

      this.savingSettings = true;
      try {
        await this.writeExperimentalSettings();
        // Save prompts to database
        await SullaSettingsModel.set('soulPrompt', this.soulPrompt, 'string');
        await SullaSettingsModel.set('heartbeatPrompt', this.heartbeatPrompt, 'string');
        console.log('[LM Settings] Settings saved');
      } catch (err) {
        console.error('Failed to save LM settings:', err);
      } finally {
        this.savingSettings = false;
      }
    },

    async writeExperimentalSettings(extra: Record<string, unknown> = {}) {

      try {
        // Save all settings to database
        const settingsToSave = {
          botName: String(this.botName || ''),
          primaryUserName: String(this.primaryUserName || ''),
          primaryProvider: String(this.primaryProvider || 'ollama'),
          secondaryProvider: String(this.secondaryProvider || 'ollama'),
          remoteProvider: String(this.selectedProvider || ''),
          remoteModel: String(this.selectedRemoteModel || ''),
          remoteApiKey: String(this.apiKey || ''),
          remoteRetryCount: Number(this.remoteRetryCount) || 3,
          remoteTimeoutSeconds: Number(this.remoteTimeoutSeconds) || 60,
          localTimeoutSeconds: Number(this.localTimeoutSeconds) || 120,
          localRetryCount: Number(this.localRetryCount) || 2,
          heartbeatEnabled: Boolean(this.heartbeatEnabled),
          heartbeatDelayMinutes: Number(this.heartbeatDelayMinutes) || 30,
          heartbeatPrompt: String(this.heartbeatPrompt || ''),
          heartbeatModel: String(this.heartbeatModel || ''),
          ...extra,
        };

        // Define cast types for settings
        const settingCasts: Record<string, string> = {
          remoteRetryCount: 'number',
          remoteTimeoutSeconds: 'number',
          localTimeoutSeconds: 'number',
          localRetryCount: 'number',
          heartbeatDelayMinutes: 'number',
          heartbeatEnabled: 'boolean',
        };

        for (const [key, value] of Object.entries(settingsToSave)) {
          const cast = settingCasts[key];
          await SullaSettingsModel.set(key, value, cast);
        }
      } catch (err) {
        console.error('[LM Settings] Error in writeExperimentalSettings:', err);
        throw err;
      }
    },

    closeWindow() {
      window.close();
    },

    // Handle model changes from other windows
    async handleModelChanged(event: IpcRendererEvent, data: { model: string; type: 'local' } | { model: string; type: 'remote'; provider: string }) {
      this.activeModel = data.model;
      this.activeMode = data.type;
      if (data.type === 'remote' && data.provider) {
        this.selectedProvider = data.provider;
        this.selectedRemoteModel = data.model;
      }
      this.pendingModel = this.activeModel;

      // Sync primary provider from the model selector (suppress watcher to avoid IPC loop)
      const newPrimary = data.type === 'local' ? 'ollama' : (data as any).provider || 'ollama';
      if (this.primaryProvider !== newPrimary) {
        this._suppressProviderWatch = true;
        this.primaryProvider = newPrimary;
      }
    },

    // Database test methods
    async runDatabaseTests() {
      if (this.runningTests) return;

      this.runningTests = true;
      this.testResults = [];
      this.finalTestResult = null;

      try {
        await this.runArticlesRegistryTests();
        await this.runSectionsRegistryTests();

        this.finalTestResult = {
          success: true,
          message: 'All database tests passed! Article, ArticlesRegistry, and SectionsRegistry classes work correctly.'
        };

      } catch (error) {
        this.finalTestResult = {
          success: false,
          message: `Tests failed: ${error instanceof Error ? error.message : String(error)}`
        };
      } finally {
        this.runningTests = false;
      }
    },

    async runArticlesRegistryTests() {
      if (this.runningArticlesTests) return;

      this.runningArticlesTests = true;
      this.articlesTestResult = null;
      const counts: any = {};

      try {
        let testSlug = randomUUID();

        await this.runTest('Article.create()', async () => {
          // Import Article class dynamically
          const { Article } = await import('../agent/database/models/Article');
          const article = await Article.create({
            section: 'knowledgebase',
            category: 'integration-test',
            slug: testSlug,
            title: 'Integration Test Article',
            tags: ['integration', 'test'],
            document: 'This is a test article created using Article.create() in the LM settings.',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          if (!article) {
            throw new Error('Article.create() returned null');
          }
        });

        await this.runTest('Article.find()', async () => {
          const { Article } = await import('../agent/database/models/Article');
          const found = await Article.find(testSlug);
          if (!found) {
            throw new Error('Article not found');
          }
        });

        await this.runTest('ArticlesRegistry.getBySlug()', async () => {
          const { ArticlesRegistry } = await import('../agent/database/registry/ArticlesRegistry');
          const registry = ArticlesRegistry.getInstance();
          const article = await registry.getBySlug(testSlug);
          if (!article) {
            throw new Error('Article not found via registry');
          }
        });

        // Add a small delay to allow embeddings to be processed
        await new Promise(resolve => setTimeout(resolve, 500));

        await this.runTest('ArticlesRegistry.search()', async () => {
          const { ArticlesRegistry } = await import('../agent/database/registry/ArticlesRegistry');
          const registry = ArticlesRegistry.getInstance();

          // First, check what articles exist at all
          const allResults = await registry.search({});
          counts.totalArticles = allResults.items.length;
          console.log(`[DEBUG] Found ${allResults.items.length} total articles`);

          // Check if our test article is in the results
          const ourArticle = allResults.items.find(item => item.slug === testSlug);
          if (ourArticle) {
            console.log(`[DEBUG] Test article found: category=${ourArticle.category}, tags=${JSON.stringify(ourArticle.tags)}`);
          } else {
            console.log(`[DEBUG] Test article NOT found in search results`);
          }

          // Use category filter instead of semantic search to avoid embedding issues
          const results = await registry.search({ category: 'integration-test' });
          if (results.items.length === 0) {
            console.log(`[DEBUG] Filtered search returned no results. Available categories:`, allResults.items.map(item => item.category));
            throw new Error('Search returned no results');
          }
        });

        await this.runTest('ArticlesRegistry.getCategories()', async () => {
          const { ArticlesRegistry } = await import('../agent/database/registry/ArticlesRegistry');
          const registry = ArticlesRegistry.getInstance();
          const categories = await registry.getCategories();
          counts.articleCategories = categories.length;
          if (!Array.isArray(categories)) {
            throw new Error('getCategories did not return an array');
          }
        });

        await this.runTest('ArticlesRegistry.getTags()', async () => {
          const { ArticlesRegistry } = await import('../agent/database/registry/ArticlesRegistry');
          const registry = ArticlesRegistry.getInstance();
          const tags = await registry.getTags();
          counts.articleTags = tags.length;
          if (!Array.isArray(tags)) {
            throw new Error('getTags did not return an array');
          }
        });

        // Clean up test article
        await this.runTest('Cleanup', async () => {
          const { ArticlesRegistry } = await import('../agent/database/registry/ArticlesRegistry');
          const registry = ArticlesRegistry.getInstance();
          await registry.deleteArticle(testSlug);
        });

        this.articlesTestResult = {
          success: true,
          message: 'Articles Registry tests passed!',
          counts
        };

      } catch (error) {
        this.articlesTestResult = {
          success: false,
          message: `Articles Registry tests failed: ${error instanceof Error ? error.message : String(error)}`,
          counts
        };
      } finally {
        this.runningArticlesTests = false;
      }
    },

    async runSectionsRegistryTests() {
      if (this.runningSectionsTests) return;

      this.runningSectionsTests = true;
      this.sectionsTestResult = null;
      const counts: any = {};

      try {
        await this.runTest('SectionsRegistry.getAllSections()', async () => {
          const { SectionsRegistry } = await import('../agent/database/registry/SectionsRegistry');
          const registry = SectionsRegistry.getInstance();
          const sections = await registry.getAllSections();
          counts.sections = sections.length;
          console.log('[DEBUG] getAllSections result:', sections);
          if (!Array.isArray(sections)) {
            throw new Error('getAllSections did not return an array');
          }
          // Log each section for debugging
          sections.forEach(section => {
            console.log('[DEBUG] Section:', section.attributes);
          });
        });

        await this.runTest('SectionsRegistry.getAllCategories()', async () => {
          const { SectionsRegistry } = await import('../agent/database/registry/SectionsRegistry');
          const registry = SectionsRegistry.getInstance();
          const categories = await registry.getAllCategories();
          counts.categories = categories.length;
          console.log('[DEBUG] getAllCategories result:', categories);
          if (!Array.isArray(categories)) {
            throw new Error('getAllCategories did not return an array');
          }
          // Log each category for debugging
          categories.forEach(category => {
            console.log('[DEBUG] Category:', category.attributes);
          });
        });

        await this.runTest('SectionsRegistry.getSectionsWithCategories()', async () => {
          const { SectionsRegistry } = await import('../agent/database/registry/SectionsRegistry');
          const registry = SectionsRegistry.getInstance();
          const sectionsWithCategories = await registry.getSectionsWithCategories();
          counts.sectionsWithCategories = sectionsWithCategories.length;
          console.log('[DEBUG] getSectionsWithCategories result:', sectionsWithCategories);
          if (!Array.isArray(sectionsWithCategories)) {
            throw new Error('getSectionsWithCategories did not return an array');
          }
          // Log the combined result for debugging
          sectionsWithCategories.forEach(section => {
            console.log('[DEBUG] Section with categories:', section);
          });
        });

        await this.runTest('SectionsRegistry.getOrphanedCategories()', async () => {
          const { SectionsRegistry } = await import('../agent/database/registry/SectionsRegistry');
          const registry = SectionsRegistry.getInstance();
          const orphanedCategories = await registry.getOrphanedCategories();
          counts.orphanedCategories = orphanedCategories.length;
          console.log('[DEBUG] getOrphanedCategories result:', orphanedCategories);
          if (!Array.isArray(orphanedCategories)) {
            throw new Error('getOrphanedCategories did not return an array');
          }
          // Log orphaned categories for debugging
          orphanedCategories.forEach(category => {
            console.log('[DEBUG] Orphaned category:', category.attributes);
          });
        });

        this.sectionsTestResult = {
          success: true,
          message: 'Sections Registry tests passed!',
          counts
        };

      } catch (error) {
        this.sectionsTestResult = {
          success: false,
          message: `Sections Registry tests failed: ${error instanceof Error ? error.message : String(error)}`,
          counts
        };
      } finally {
        this.runningSectionsTests = false;
      }
    },

    runTest(testName: string, testFn: () => Promise<void>) {
      this.addTestResult('info', `🧪 Running ${testName}...`);
      return testFn()
        .then(() => {
          this.addTestResult('pass', `✅ ${testName} passed`);
        })
        .catch((error) => {
          this.addTestResult('fail', `❌ ${testName} failed: ${error instanceof Error ? error.message : String(error)}`);
          throw error;
        });
    },

    addTestResult(status: 'pass' | 'fail' | 'info', message: string) {
      this.testResults.push({ status, message });
    },

    async rerunMigrations() {
      if (this.runningMigrations) return;

      this.runningMigrations = true;
      this.addTestResult('info', '🔄 Starting database migrations...');

      try {
        const { getDatabaseManager } = await import('../agent/database/DatabaseManager');
        const dbManager = getDatabaseManager();

        // Access the private method by casting
        const runMigrationsMethod = (dbManager as any).runMigrations.bind(dbManager);
        await runMigrationsMethod();

        this.addTestResult('pass', '✅ Database migrations completed successfully');
      } catch (error) {
        this.addTestResult('fail', `❌ Migrations failed: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        this.runningMigrations = false;
      }
    },

    async rerunSeeders() {
      if (this.runningSeeders) return;

      this.runningSeeders = true;
      this.addTestResult('info', '🌱 Starting database seeders...');

      try {
        const { getDatabaseManager } = await import('../agent/database/DatabaseManager');
        const dbManager = getDatabaseManager();

        // Access the private method by casting
        const runSeedersMethod = (dbManager as any).runSeeders.bind(dbManager);
        await runSeedersMethod();

        this.addTestResult('pass', '✅ Database seeders completed successfully');
      } catch (error) {
        this.addTestResult('fail', `❌ Seeders failed: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        this.runningSeeders = false;
      }
    },

    clearTestResults() {
      this.testResults = [];
      this.finalTestResult = null;
    },

    async runN8nServiceTest() {
      if (this.runningN8nTest) return;

      this.runningN8nTest = true;
      this.n8nTestResult = null;

      const testResults = [];

      console.log('[N8n Test] Starting comprehensive N8nService class test');

      try {
        // Create and initialize N8nService instance
        const { createN8nService } = await import('../agent/services/N8nService');
        const n8nService = await createN8nService();

        console.log('[N8n Test] N8nService instance created and initialized');

        // Test 1: Health check via service
        console.log('[N8n Test] Testing N8nService.healthCheck()...');
        try {
          const isHealthy = await n8nService.healthCheck();
          if (isHealthy) {
            testResults.push({ endpoint: 'healthCheck()', status: 'PASS', message: 'Health check passed via N8nService' });
          } else {
            testResults.push({ endpoint: 'healthCheck()', status: 'FAIL', message: 'Health check failed via N8nService' });
          }
        } catch (error) {
          testResults.push({
            endpoint: 'healthCheck()',
            status: 'FAIL',
            message: `Health check error: ${error instanceof Error ? error.message : String(error)}`
          });
        }

        // Test 2: Get workflows
        console.log('[N8n Test] Testing N8nService.getWorkflows()...');
        try {
          const workflows = await n8nService.getWorkflows();
          testResults.push({
            endpoint: 'getWorkflows()',
            status: 'PASS',
            message: `Workflows retrieved successfully (${Array.isArray(workflows) ? workflows.length : 'unknown'} workflows)`
          });
        } catch (error) {
          testResults.push({
            endpoint: 'getWorkflows()',
            status: 'FAIL',
            message: `Get workflows error: ${error instanceof Error ? error.message : String(error)}`
          });
        }

        // Test 3: Get executions
        console.log('[N8n Test] Testing N8nService.getExecutions()...');
        try {
          const executions = await n8nService.getExecutions();
          testResults.push({
            endpoint: 'getExecutions()',
            status: 'PASS',
            message: `Executions retrieved successfully (${Array.isArray(executions) ? executions.length : 'unknown'} executions)`
          });
        } catch (error) {
          testResults.push({
            endpoint: 'getExecutions()',
            status: 'FAIL',
            message: `Get executions error: ${error instanceof Error ? error.message : String(error)}`
          });
        }

        // Test 4: Get credentials
        console.log('[N8n Test] Testing N8nService.getCredentials()...');
        try {
          const credentials = await n8nService.getCredentials();
          testResults.push({
            endpoint: 'getCredentials()',
            status: 'PASS',
            message: `Credentials retrieved successfully (${Array.isArray(credentials) ? credentials.length : 'unknown'} credentials)`
          });
        } catch (error) {
          testResults.push({
            endpoint: 'getCredentials()',
            status: 'FAIL',
            message: `Get credentials error: ${error instanceof Error ? error.message : String(error)}`
          });
        }

        // Test 5: Get current user
        console.log('[N8n Test] Testing N8nService.getCurrentUser()...');
        try {
          const currentUser = await n8nService.getCurrentUser();
          testResults.push({
            endpoint: 'getCurrentUser()',
            status: 'PASS',
            message: `Current user retrieved successfully (email: ${currentUser?.email || 'unknown'})`
          });
        } catch (error) {
          testResults.push({
            endpoint: 'getCurrentUser()',
            status: 'FAIL',
            message: `Get current user error: ${error instanceof Error ? error.message : String(error)}`
          });
        }

        // Test 6: Get tags
        console.log('[N8n Test] Testing N8nService.getTags()...');
        try {
          const tags = await n8nService.getTags();
          testResults.push({
            endpoint: 'getTags()',
            status: 'PASS',
            message: `Tags retrieved successfully (${Array.isArray(tags) ? tags.length : 'unknown'} tags)`
          });
        } catch (error) {
          testResults.push({
            endpoint: 'getTags()',
            status: 'FAIL',
            message: `Get tags error: ${error instanceof Error ? error.message : String(error)}`
          });
        }

        // Summarize results
        const passedTests = testResults.filter(t => t.status === 'PASS').length;
        const totalTests = testResults.length;
        const failedTests = testResults.filter(t => t.status === 'FAIL');

        console.log(`[N8n Test] Completed: ${passedTests}/${totalTests} N8nService tests passed`);

        if (failedTests.length === 0) {
          this.n8nTestResult = {
            success: true,
            message: `All N8nService methods are working! (${passedTests}/${totalTests} tests passed)`,
            data: { testResults }
          };
        } else {
          this.n8nTestResult = {
            success: false,
            message: `Some N8nService methods failed: ${failedTests.length} failed, ${passedTests} passed`,
            data: { testResults }
          };
        }

      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.log('[N8n Test] Error caught:', err);
        console.log('[N8n Test] Error name:', err.name);
        console.log('[N8n Test] Error message:', err.message);

        this.n8nTestResult = { success: false, message: `N8nService test failed: ${err.message}` };
      } finally {
        this.runningN8nTest = false;
        console.log('[N8n Test] Test completed');
      }
    },
  },
});
</script>

<template>
  <div class="lm-settings">
    <PostHogTracker page-name="LanguageModelSettings" />
    <!-- Header -->
    <div class="lm-header">
      <h1>Language Model Settings</h1>
    </div>

    <!-- Main content with sidebar -->
    <div class="lm-content">
      <!-- Sidebar navigation -->
      <nav class="lm-nav">
        <div
          v-for="item in navItems"
          :key="item.id"
          class="nav-item"
          :class="{ active: currentNav === item.id }"
          @click="navClicked(item.id)"
        >
          {{ item.name }}
        </div>
      </nav>

      <!-- Content area -->
      <div class="lm-body">
        <!-- Overview Tab -->
        <div
          v-if="currentNav === 'overview'"
          class="tab-content"
        >
          <h2>Ollama Container Status</h2>
          <p class="description">
            Monitor the resource usage of your local Ollama container.
          </p>

          <!-- Status Badge -->
          <div class="status-section">
            <span class="status-label">Status:</span>
            <span
              class="status-badge"
              :class="{
                'status-running': containerStats.status === 'running',
                'status-stopped': containerStats.status === 'exited' || containerStats.status === 'stopped',
                'status-error': containerStats.status === 'error' || containerStats.status === 'docker_unavailable',
                'status-unknown': containerStats.status === 'unknown' || containerStats.status === 'not_found',
              }"
            >
              {{ containerStats.status === 'docker_unavailable' ? 'Docker Unavailable' :
                 containerStats.status === 'not_found' ? 'Container Not Found' :
                 containerStats.status.charAt(0).toUpperCase() + containerStats.status.slice(1) }}
            </span>
          </div>

          <!-- Metrics Cards -->
          <div
            v-if="containerStats.status === 'running'"
            class="metrics-grid"
          >
            <!-- Running Models -->
            <div class="metric-card">
              <div class="metric-header">
                <span class="metric-title">Running Models</span>
              </div>
              <div class="metric-value">
                {{ (containerStats as any).runningModels || 0 }}
              </div>
              <div
                v-if="(containerStats as any).modelDetails?.length"
                class="metric-subtext"
              >
                {{ (containerStats as any).modelDetails.map((m: any) => m.name).join(', ') }}
              </div>
              <div
                v-else
                class="metric-subtext"
              >
                No models loaded
              </div>
            </div>

            <!-- Model Memory Usage -->
            <div class="metric-card">
              <div class="metric-header">
                <span class="metric-title">Model Memory</span>
              </div>
              <div class="metric-value">
                {{ formattedMemoryUsage }}
              </div>
              <div class="metric-bar">
                <div
                  class="metric-bar-fill memory-bar"
                  :style="{ width: Math.min(containerStats.memoryPercent, 100) + '%' }"
                />
              </div>
              <div class="metric-subtext">
                Memory used by loaded models
              </div>
            </div>
          </div>

          <!-- Not Running Message -->
          <div
            v-else
            class="not-running-message"
          >
            <p v-if="containerStats.status === 'offline'">
              Ollama service is offline. Make sure it's running on port 30114.
            </p>
            <p v-else-if="containerStats.status === 'error'">
              Unable to connect to Ollama service.
            </p>
            <p v-else>
              Checking Ollama status...
            </p>
          </div>

          <!-- Active Model Info -->
          <div class="active-model-section">
            <h3>Active Configuration</h3>
            <div class="config-item">
              <span class="config-label">Mode:</span>
              <span class="config-value">{{ activeMode === 'local' ? 'Local (Ollama)' : 'Remote (API)' }}</span>
            </div>
            <div
              v-if="activeMode === 'local'"
              class="config-item"
            >
              <span class="config-label">Model:</span>
              <span class="config-value">{{ activeModel }}</span>
            </div>
            <div
              v-else
              class="config-item"
            >
              <span class="config-label">Provider:</span>
              <span class="config-value">{{ selectedProvider }} / {{ selectedRemoteModel }}</span>
            </div>
          </div>
        </div>

        <!-- Models Tab -->
        <div
          v-if="currentNav === 'models'"
          class="tab-content"
        >
          <!-- Primary Provider -->
          <div class="setting-group">
            <label class="setting-label">Primary Provider</label>
            <select
              v-model="primaryProvider"
              class="model-select"
            >
              <option
                v-for="provider in availableProviders"
                :key="provider.id"
                :value="provider.id"
              >
                {{ provider.name }}
              </option>
            </select>
            <p class="setting-description">
              The main language model provider used for all agent tasks.
            </p>
          </div>

          <!-- Secondary (Fallback) Provider -->
          <div class="setting-group">
            <label class="setting-label">Secondary Provider (Fallback)</label>
            <select
              v-model="secondaryProvider"
              class="model-select"
            >
              <option
                v-for="provider in availableProviders"
                :key="provider.id"
                :value="provider.id"
              >
                {{ provider.name }}
              </option>
            </select>
            <p class="setting-description">
              If for some reason the primary provider is inaccessible, we will fall back to the secondary provider.
            </p>
          </div>

          <div
            v-if="availableProviders.length <= 1"
            style="margin-top: 1rem; padding: 1rem; border-radius: 8px; border: 1px solid var(--border, #e2e8f0); background: var(--surface-alt, #f8fafc);"
          >
            <p style="font-size: 0.9rem; color: var(--muted);">
              Only Ollama (local) is available. To add remote providers, go to
              <strong>Integrations</strong> and configure an AI provider (e.g. Grok, OpenAI, Anthropic).
            </p>
          </div>
        </div>

        <!-- Soul Tab -->
        <div
          v-if="currentNav === 'soul'"
          class="tab-content"
        >
          <h2>Soul</h2>
          <p class="description">
            Configure the agent's identity and system prompt. The bot name and user name will be prefixed to the soul prompt.
          </p>

          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label class="form-label">Bot Name</label>
            <input
              v-model="botName"
              type="text"
              class="text-input"
              placeholder="Sulla"
              style="max-width: 400px;"
            >
            <p class="setting-description">
              The name of the AI assistant (default: Sulla)
            </p>
          </div>

          <div class="form-group" style="margin-bottom: 2rem;">
            <label class="form-label">Your Human's Name</label>
            <input
              v-model="primaryUserName"
              type="text"
              class="text-input"
              placeholder="Enter your name (optional)"
              style="max-width: 400px;"
            >
            <p class="setting-description">
              Your name (optional) - helps personalize interactions
            </p>
          </div>

          <div class="form-group">
            <label class="form-label">Soul Prompt</label>
            <textarea
              v-model="soulPromptEditor"
              class="soul-textarea"
              spellcheck="false"
            />
            <p class="setting-description">
              The system prompt that shapes the agent's personality and behavior. Leave blank to use the built-in default.
            </p>
            <div class="soul-actions">
              <button
                class="btn role-secondary"
                type="button"
                @click="soulPrompt = soulPromptDefault"
              >
                Reset to default
              </button>
            </div>
          </div>
        </div>

        <!-- Heartbeat Tab -->
        <div
          v-if="currentNav === 'heartbeat'"
          class="tab-content"
        >
          <h2>Heartbeat Settings</h2>
          <p class="description">
            Configure a periodic heartbeat that triggers the agent to check in and review its state.
          </p>

          <!-- Enable/Disable Toggle -->
          <div class="setting-group">
            <label class="setting-label">Enable Heartbeat</label>
            <div class="toggle-switch">
              <label class="switch">
                <input
                  v-model="heartbeatEnabled"
                  type="checkbox"
                >
                <span class="slider" />
              </label>
              <span class="toggle-label">{{ heartbeatEnabled ? 'Enabled' : 'Disabled' }}</span>
            </div>
            <p class="setting-description">
              When enabled, the agent will periodically wake up and process the heartbeat prompt.
            </p>
          </div>

          <!-- Delay Setting -->
          <div class="setting-group">
            <label class="setting-label">Heartbeat Interval (minutes)</label>
            <div class="delay-input">
              <input
                v-model.number="heartbeatDelayMinutes"
                type="number"
                class="text-input"
                min="1"
                max="1440"
                style="width: 120px;"
              >
            </div>
            <p class="setting-description">
              How often the heartbeat should trigger (1-1440 minutes). Default is 30 minutes.
            </p>
          </div>

          <!-- Model Setting -->
          <div class="setting-group">
            <label class="setting-label">Heartbeat Model</label>
            <select
              v-model="heartbeatModel"
              class="model-select"
            >
              <option value="default">
                Use System Default
              </option>
              <optgroup label="Local Models (Ollama)">
                <option
                  v-for="model in installedModels"
                  :key="'local:' + model.name"
                  :value="'local:' + model.name"
                >
                  {{ model.name }}
                </option>
              </optgroup>
              <optgroup
                v-for="provider in remoteProviders"
                :key="provider.id"
                :label="'Remote: ' + provider.name"
              >
                <option
                  v-for="model in provider.models"
                  :key="'remote:' + provider.id + ':' + model.id"
                  :value="'remote:' + provider.id + ':' + model.id"
                >
                  {{ model.name }}
                </option>
              </optgroup>
            </select>
            <p class="setting-description">
              Select which model to use for heartbeat processing. "Use System Default" follows your main model settings.
            </p>
          </div>

          <!-- Instructions Setting -->
          <div class="setting-group">
            <label class="setting-label">Heartbeat Instructions</label>
            <textarea
              v-model="heartbeatPromptEditor"
              class="soul-textarea"
              spellcheck="false"
            />
            <p class="setting-description">
              Instructions sent to the agent each time the heartbeat triggers. Leave blank to use the built-in default.
            </p>
            <div class="soul-actions">
              <button
                class="btn role-secondary"
                type="button"
                @click="heartbeatPrompt = heartbeatPromptDefault"
              >
                Reset to default
              </button>
            </div>
          </div>
        </div>

        <!-- Database Tests Tab -->
        <div
          v-if="currentNav === 'database'"
          class="tab-content"
        >
          <h2>Database Tests</h2>
          <p class="description">
            Test Vectordb functionality and verify that the Article and ArticlesRegistry classes work correctly.
          </p>

          <div class="diagnostics-grid">
            <div class="diagnostics-left">
              <div class="space-y-6">
                <div class="flex flex-col gap-4">
                  <button
                    @click="runArticlesRegistryTests"
                    :disabled="runningArticlesTests"
                    class="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {{ runningArticlesTests ? 'Testing Articles...' : 'Test Articles Registry' }}
                  </button>
                  <button
                    @click="runSectionsRegistryTests"
                    :disabled="runningSectionsTests"
                    class="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {{ runningSectionsTests ? 'Testing Sections...' : 'Test Sections Registry' }}
                  </button>
                  <button
                    @click="runDatabaseTests"
                    :disabled="runningTests"
                    class="w-full px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-700 disabled:opacity-50"
                  >
                    {{ runningTests ? 'Running All Tests...' : 'Run All Database Tests' }}
                  </button>
                  <button
                    @click="rerunMigrations"
                    :disabled="runningMigrations"
                    class="w-full px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
                  >
                    {{ runningMigrations ? 'Running Migrations...' : 'Rerun Migrations' }}
                  </button>
                  <button
                    @click="rerunSeeders"
                    :disabled="runningSeeders"
                    class="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  >
                    {{ runningSeeders ? 'Running Seeders...' : 'Rerun Seeders' }}
                  </button>
                  <button
                    @click="clearTestResults"
                    class="w-full px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700"
                  >
                    Clear Results
                  </button>
                  <button
                    @click="runN8nServiceTest"
                    :disabled="runningN8nTest"
                    class="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {{ runningN8nTest ? 'Testing N8n Service...' : 'Test N8n Service' }}
                  </button>
                </div>
              </div>
            </div>

            <div class="diagnostics-right">
              <!-- Articles Registry Test Results -->
              <div v-if="articlesTestResult" class="p-4 rounded" :class="articlesTestResult.success ? 'bg-blue-50 text-blue-800' : 'bg-red-50 text-red-800'">
                <h3 class="font-semibold">{{ articlesTestResult.success ? '✅ Articles Registry Tests Passed!' : '❌ Articles Registry Tests Failed' }}</h3>
                <p>{{ articlesTestResult.message }}</p>
                <div v-if="articlesTestResult.counts" class="mt-2 text-sm">
                  <div><strong>Counts:</strong></div>
                  <div v-if="articlesTestResult.counts.totalArticles !== undefined">Articles: {{ articlesTestResult.counts.totalArticles }}</div>
                  <div v-if="articlesTestResult.counts.articleCategories !== undefined">Categories: {{ articlesTestResult.counts.articleCategories }}</div>
                  <div v-if="articlesTestResult.counts.articleTags !== undefined">Tags: {{ articlesTestResult.counts.articleTags }}</div>
                </div>
              </div>

              <!-- Sections Registry Test Results -->
              <div v-if="sectionsTestResult" class="p-4 rounded" :class="sectionsTestResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'">
                <h3 class="font-semibold">{{ sectionsTestResult.success ? '✅ Sections Registry Tests Passed!' : '❌ Sections Registry Tests Failed' }}</h3>
                <p>{{ sectionsTestResult.message }}</p>
                <div v-if="sectionsTestResult.counts" class="mt-2 text-sm">
                  <div><strong>Counts:</strong></div>
                  <div v-if="sectionsTestResult.counts.sections !== undefined">Sections: {{ sectionsTestResult.counts.sections }}</div>
                  <div v-if="sectionsTestResult.counts.categories !== undefined">Categories: {{ sectionsTestResult.counts.categories }}</div>
                  <div v-if="sectionsTestResult.counts.sectionsWithCategories !== undefined">Sections with Categories: {{ sectionsTestResult.counts.sectionsWithCategories }}</div>
                  <div v-if="sectionsTestResult.counts.orphanedCategories !== undefined">Orphaned Categories: {{ sectionsTestResult.counts.orphanedCategories }}</div>
                </div>
              </div>

              <div v-if="testResults.length > 0" class="space-y-2">
                <h3 class="text-lg font-semibold">Detailed Test Results:</h3>
                <div class="bg-slate-50 dark:bg-slate-800 rounded p-4 font-mono text-sm">
                  <div
                    v-for="(result, index) in testResults"
                    :key="index"
                    :class="[
                      'mb-2',
                      result.status === 'pass' ? 'text-green-600' :
                      result.status === 'fail' ? 'text-red-600' : 'text-blue-600'
                    ]"
                  >
                    {{ result.message }}
                  </div>
                </div>
              </div>

              <div v-if="finalTestResult" class="p-4 rounded" :class="finalTestResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'">
                <h3 class="font-semibold">{{ finalTestResult.success ? '✅ All Tests Passed!' : '❌ Tests Failed' }}</h3>
                <p>{{ finalTestResult.message }}</p>
              </div>

              <div v-if="n8nTestResult" class="p-4 rounded" :class="n8nTestResult.success ? 'bg-indigo-50 text-indigo-800' : 'bg-red-50 text-red-800'">
                <h3 class="font-semibold">{{ n8nTestResult.success ? '✅ N8n Service Test Passed!' : '❌ N8n Service Test Failed' }}</h3>
                <p>{{ n8nTestResult.message }}</p>
                <div v-if="n8nTestResult.data" class="mt-2 text-sm">
                  <div><strong>Data:</strong></div>
                  <pre>{{ JSON.stringify(n8nTestResult.data, null, 2) }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Footer -->
    <div class="lm-footer">
      <button
        class="btn role-primary"
        :disabled="activating || savingSettings"
        @click="saveSettings"
      >
        {{ savingSettings ? 'Saving...' : 'Save' }}
      </button>
      <button
        class="btn role-secondary"
        @click="closeWindow"
      >
        Close
      </button>
    </div>
  </div>
</template>

<style lang="scss" src="@pkg/assets/styles/app.scss"></style>
<style lang="scss" scoped>
.lm-settings {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--body-bg);
  color: var(--body-text);
}

.lm-header {
  height: 3rem;
  font-size: 1.5rem;
  line-height: 2rem;
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  width: 100%;
  border-bottom: 1px solid var(--header-border);

  h1 {
    flex: 1;
    margin: 0;
    font-size: inherit;
    font-weight: normal;
  }
}

.lm-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.lm-nav {
  width: 200px;
  border-right: 1px solid var(--header-border);
  padding-top: 0.75rem;
  flex-shrink: 0;

  .nav-item {
    font-size: 1.125rem;
    line-height: 1.75rem;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    user-select: none;

    &.active {
      background-color: var(--nav-active);
    }
  }
}

.lm-body {
  flex: 1;
  padding: 1.5rem;
  overflow: auto;
}

.active-mode-banner {
  background: var(--primary-bg, rgba(59, 130, 246, 0.1));
  border: 1px solid var(--primary, #3b82f6);
  border-radius: 6px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  .active-label {
    font-weight: 600;
    color: var(--primary, #3b82f6);
  }

  .active-value {
    color: var(--body-text);
  }
}

.model-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid var(--input-border);
}

.model-tab {
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: none;
  border-top: none;
  border-left: none;
  border-right: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  font-size: 0.95rem;
  color: var(--muted);
  transition: all 0.2s;
  outline: none;

  &:focus {
    outline: none;
    box-shadow: none;
  }

  &:focus-visible {
    outline: 2px solid var(--primary, #3b82f6);
    outline-offset: -2px;
  }

  &:hover {
    color: var(--body-text);
    background: var(--nav-active);
  }

  &.active {
    color: var(--primary, #3b82f6);
    border-bottom-color: var(--primary, #3b82f6);
    font-weight: 500;
    background: var(--primary-bg, rgba(59, 130, 246, 0.1));
  }
}

.activate-section {
  margin-bottom: 1.5rem;
}

.activate-btn {
  min-width: 200px;

  &.is-active {
    background: var(--success, #22c55e) !important;
    border-color: var(--success, #22c55e) !important;
    color: white !important;
    opacity: 1 !important;
    cursor: default;
  }

  &.is-active:disabled {
    background: var(--success, #22c55e) !important;
    border-color: var(--success, #22c55e) !important;
    color: white !important;
    opacity: 1 !important;
  }
}

.activation-error {
  background: var(--error-bg, rgba(239, 68, 68, 0.1));
  border: 1px solid var(--error, #ef4444);
  border-radius: 6px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  color: var(--error, #ef4444);
  font-size: 0.9rem;
}

.tab-content {
  h2 {
    margin: 0 0 0.5rem;
    font-size: 1.1rem;
    font-weight: 500;
  }

  h3 {
    margin: 1.5rem 0 0.75rem;
    font-size: 1rem;
    font-weight: 500;
  }

  .description {
    color: var(--muted);
    margin-bottom: 1.5rem;
  }
}

// Overview tab styles
.status-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;

  .status-label {
    font-weight: 500;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.85rem;
    font-weight: 500;

    &.status-running {
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
    }

    &.status-stopped {
      background: rgba(234, 179, 8, 0.15);
      color: #eab308;
    }

    &.status-error {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }

    &.status-unknown {
      background: rgba(156, 163, 175, 0.15);
      color: #9ca3af;
    }
  }
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.metric-card {
  background: var(--input-bg, rgba(0, 0, 0, 0.1));
  border: 1px solid var(--input-border);
  border-radius: 8px;
  padding: 1rem;

  .metric-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .metric-title {
    font-size: 0.9rem;
    color: var(--muted);
  }

  .metric-value {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
  }

  .metric-bar {
    height: 8px;
    background: var(--input-border);
    border-radius: 4px;
    overflow: hidden;
  }

  .metric-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;

    &.cpu-bar {
      background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    }

    &.memory-bar {
      background: linear-gradient(90deg, #22c55e, #eab308);
    }
  }

  .metric-subtext {
    font-size: 0.8rem;
    color: var(--muted);
    margin-top: 0.5rem;
  }
}

.not-running-message {
  background: var(--input-bg, rgba(0, 0, 0, 0.1));
  border: 1px solid var(--input-border);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  color: var(--muted);

  p {
    margin: 0;
  }
}

.active-model-section {
  background: var(--input-bg, rgba(0, 0, 0, 0.1));
  border: 1px solid var(--input-border);
  border-radius: 8px;
  padding: 1rem;

  h3 {
    margin: 0 0 0.75rem !important;
  }

  .config-item {
    display: flex;
    gap: 0.5rem;
    padding: 0.25rem 0;

    .config-label {
      color: var(--muted);
      min-width: 80px;
    }

    .config-value {
      font-weight: 500;
    }
  }
}

.lm-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--header-border);
  display: flex;
  justify-content: flex-end;
}

// Models tab styles
.setting-group {
  margin-bottom: 1.5rem;

  .setting-label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.5rem;
  }

  .setting-description {
    color: var(--muted);
    font-size: 0.875rem;
    margin-top: 0.5rem;
    opacity: 0.6;
    margin-bottom: 0.5rem;

    .provider-signup-link {
      color: var(--primary, #3b82f6);
      text-decoration: none;
      font-weight: 500;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}

.radio-group {
  display: flex;
  gap: 1.5rem;

  .radio-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;

    input[type="radio"] {
      cursor: pointer;
    }
  }
}

.current-model {
  font-size: 0.875rem;
  color: var(--muted);
  margin-bottom: 0.5rem;

  strong {
    color: var(--body-text);
  }
}

.model-select {
  width: 100%;
  max-width: 400px;
  padding: 0.5rem;
  font-size: 0.9rem;
  border: 1px solid var(--input-border);
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--input-text);

  &:focus {
    outline: none;
    border-color: var(--primary);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.soul-textarea {
  width: 100%;
  max-width: 900px;
  padding: 0.75rem;
  font-size: 0.85rem;
  line-height: 1.5;
  border: 1px solid var(--input-border);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--input-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  resize: vertical;
  min-height: 520px;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.soul-actions {
  margin-top: 0.75rem;
  display: flex;
  gap: 0.75rem;
}

.text-input {
  flex: 1;
  padding: 0.5rem;
  font-size: 0.9rem;
  border: 1px solid var(--input-border);
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--input-text);

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.api-key-input {
  display: flex;
  gap: 0.5rem;
  max-width: 500px;

  .text-input {
    flex: 1;
  }
}

// Toggle switch styles
.toggle-switch {
  display: flex;
  align-items: center;
  gap: 0.75rem;

  .toggle-label {
    font-size: 0.9rem;
    color: var(--body-text);
  }
}

.switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--input-border);
    transition: 0.3s;
    border-radius: 24px;

    &::before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: 0.3s;
      border-radius: 50%;
    }
  }

  input:checked + .slider {
    background-color: var(--primary, #3b82f6);
  }

  input:checked + .slider::before {
    transform: translateX(24px);
  }

  input:disabled + .slider {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.prompt-textarea {
  width: 100%;
  max-width: 600px;
  padding: 0.75rem;
  font-size: 0.9rem;
  border: 1px solid var(--input-border);
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--input-text);
  font-family: inherit;
  resize: vertical;
  min-height: 100px;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.model-action {
  margin-top: 1rem;
}

.model-status {
  font-size: 0.875rem;
  margin-bottom: 0.5rem;

  &.not-installed {
    color: var(--warning, #f59e0b);
  }

  &.installed {
    color: var(--success, #22c55e);
  }

  &.downloading {
    color: var(--primary);
  }
}

.download-progress {
  margin-top: 1rem;
}

.progress-bar {
  width: 100%;
  max-width: 400px;
  height: 8px;
  background: var(--input-border);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.75rem;
  color: var(--muted);
  margin-top: 0.25rem;
}

.model-status-section {
  border: 1px solid var(--input-border);
  border-radius: 6px;
  padding: 1rem;
  background: var(--input-bg);
}

.downloaded-models-list {
  margin-bottom: 1.5rem;
}

.model-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--input-border);
  border-radius: 4px;
  background: var(--body-bg);
}

.model-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--input-border);
  font-size: 0.85rem;
}

.model-item:last-child {
  border-bottom: none;
}

.model-name {
  font-weight: 500;
  color: var(--body-text);
}

.model-size {
  color: var(--muted);
  font-size: 0.8rem;
}

.key-models-status {
  margin-bottom: 1rem;
}

.model-status-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  border-radius: 4px;
  background: var(--body-bg);
  border: 1px solid var(--input-border);
}

.status-label {
  font-size: 0.85rem;
  color: var(--body-text);
  font-weight: 500;
  flex: 1;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.status-installed {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.status-missing {
  background: rgba(234, 179, 8, 0.15);
  color: #eab308;
}

.status-failed {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.no-models-message {
  padding: 1rem;
  text-align: center;
  color: var(--muted);
}

.download-section {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;

  input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--input-border);
    border-radius: 4px;
    background: var(--input-bg);
    color: var(--input-text);

    &:focus {
      outline: none;
      border-color: var(--primary);
    }
  }
}

.models-table {
  width: 100%;
  border-collapse: collapse;

  th, td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--header-border);
  }

  th {
    font-weight: 500;
    color: var(--muted);
    font-size: 0.875rem;
  }

  .model-name {
    font-weight: 500;
  }
}

// Memory tab styles
.memory-layout {
  display: flex;
  gap: 1rem;
  height: calc(100vh - 280px);
}

.pages-list {
  width: 250px;
  border: 1px solid var(--header-border);
  border-radius: 4px;
  overflow: auto;

  .page-item {
    padding: 0.75rem;
    border-bottom: 1px solid var(--header-border);
    cursor: pointer;

    &:hover {
      background: var(--dropdown-hover-bg);
    }

    &.selected {
      background: var(--primary);
      color: var(--primary-text);
    }

    .page-title {
      display: block;
      font-weight: 500;
    }

    .page-type {
      font-size: 0.75rem;
      color: var(--muted);
    }

    &.selected .page-type {
      color: inherit;
      opacity: 0.8;
    }
  }
}

.page-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--header-border);
  border-radius: 4px;
  padding: 1rem;

  .editor-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;

    h3 {
      margin: 0;
      font-size: 1rem;
    }

    .badge {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      background: var(--muted);
      color: var(--body-bg);
      border-radius: 4px;
    }
  }

  .editor-textarea {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid var(--input-border);
    border-radius: 4px;
    background: var(--input-bg);
    color: var(--input-text);
    resize: none;
    font-family: inherit;

    &:focus {
      outline: none;
      border-color: var(--primary);
    }
  }

  .editor-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
}

// Resources tab styles
.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.service-card {
  border: 1px solid var(--header-border);
  border-radius: 8px;
  padding: 1.25rem;

  .service-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;

    h3 {
      margin: 0;
      font-size: 1rem;
    }
  }

  p {
    color: var(--muted);
    font-size: 0.875rem;
    margin: 0 0 1rem;
  }

  .service-actions {
    display: flex;
    gap: 0.5rem;
  }
}

.status-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  text-transform: capitalize;

  &.running {
    background: #22c55e;
    color: white;
  }

  &.stopped {
    background: #ef4444;
    color: white;
  }

  &.error {
    background: #f59e0b;
    color: white;
  }

  &.unknown {
    background: var(--muted);
    color: white;
  }
}

// Logs tab styles
.logs-container {
  height: calc(100vh - 280px);
  border: 1px solid var(--header-border);
  border-radius: 4px;
  overflow: auto;
}

.logs-output {
  margin: 0;
  padding: 1rem;
  font-family: monospace;
  font-size: 0.875rem;
  white-space: pre-wrap;
  word-break: break-all;
}

// Common styles
.loading, .empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--muted);
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.15s;

  &.role-primary {
    background: var(--primary);
    color: var(--primary-text);

    &:hover {
      opacity: 0.9;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &.role-secondary {
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    color: var(--body-text);

    &:hover {
      background: var(--dropdown-hover-bg);
    }
  }

  &.btn-sm {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }
}

// Diagnostics tab styles
.diagnostics-grid {
  display: grid;
  grid-template-columns: 25% 1fr;
  gap: 2rem;
  align-items: start;
}

.diagnostics-left {
  // Left column for buttons and options
}

.diagnostics-right {
  // Right column for output and results
  max-height: 70vh;
  overflow-y: auto;
}

</style>
