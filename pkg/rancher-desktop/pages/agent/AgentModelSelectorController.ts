import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import { ipcRenderer } from '@pkg/utils/ipcRenderer';
import { SullaSettingsModel } from '@pkg/agent/database/models/SullaSettingsModel';

type ModelOption =
  | { type: 'local'; value: string; label: string; isActive: boolean }
  | { type: 'remote'; provider: string; value: string; label: string; isActive: boolean };

export class AgentModelSelectorController {
  readonly showModelMenu = ref(false);
  readonly modelMenuEl = ref<HTMLElement | null>(null);
  readonly buttonRef = ref<HTMLElement | null>(null);
  readonly loadingLocalModels = ref(false);

  private readonly installedLocalModels = ref<string[]>([]);

  private readonly remoteProvider = ref<string>('');
  private readonly remoteModel = ref<string>('');
  private readonly remoteApiKey = ref<string>('');

  readonly activeModelLabel: ComputedRef<string>;
  readonly localModelOptions: ComputedRef<ModelOption[]>;
  readonly remoteOption: ComputedRef<ModelOption | null>;
  readonly isRunningValue: ComputedRef<boolean>;

  constructor(private readonly deps: {
    systemReady: Ref<boolean>;
    loading: Ref<boolean>;
    isRunning: Ref<boolean>;

    modelName: Ref<string>;
    modelMode: Ref<'local' | 'remote'>;
  }) {
    this.activeModelLabel = computed(() => {
      if (this.deps.modelMode.value === 'remote') {
        return this.remoteModel.value || this.deps.modelName.value || 'Remote';
      }

      return this.deps.modelName.value || 'Local';
    });

    this.localModelOptions = computed(() => {
      return this.installedLocalModels.value.map((name) => ({
        type: 'local',
        value: name,
        label: name,
        isActive: this.deps.modelMode.value === 'local' && this.deps.modelName.value === name,
      }));
    });

    this.remoteOption = computed(() => {
      if (!this.remoteProvider.value || !this.remoteModel.value || !this.remoteApiKey.value) {
        return null;
      }

      return {
        type: 'remote',
        provider: this.remoteProvider.value,
        value: this.remoteModel.value,
        label: `${ this.remoteProvider.value } / ${ this.remoteModel.value }`,
        isActive: this.deps.modelMode.value === 'remote',
      };
    });

    this.isRunningValue = computed(() => this.deps.isRunning.value);
  }

  async start(): Promise<void> {
    document.addEventListener('mousedown', this.handleDocumentClick);

    await this.loadRemoteSettings();
    await this.refreshInstalledLocalModels();
  }

  dispose(): void {
    document.removeEventListener('mousedown', this.handleDocumentClick);
  }

  get showModelMenuValue(): boolean {
    return this.showModelMenu.value;
  }

  get loadingLocalModelsValue(): boolean {
    return this.loadingLocalModels.value;
  }

  get activeModelLabelValue(): string {
    return this.activeModelLabel.value;
  }

  get localModelOptionsValue(): ModelOption[] {
    return this.localModelOptions.value;
  }

  get remoteOptionValue(): ModelOption | null {
    return this.remoteOption.value;
  }

  async toggleModelMenu(): Promise<void> {
    if (!this.deps.systemReady.value) {
      return;
    }

    this.showModelMenu.value = !this.showModelMenu.value;
    if (this.showModelMenu.value) {
      await this.refreshInstalledLocalModels();
    }
  }

  hideModelMenu(): void {
    this.showModelMenu.value = false;
  }

  async selectModel(option: ModelOption): Promise<void> {
    try {
      if (option.type === 'local') {
          SullaSettingsModel.set('modelMode', 'local');
          SullaSettingsModel.set('sullaModel', option.value);
      } else {

        // Save model mode, remote provider, remote model, and remote API key to new settings
        SullaSettingsModel.set('modelMode', 'remote');
        SullaSettingsModel.set('remoteProvider', option.provider);
        SullaSettingsModel.set('remoteModel', option.value);
        SullaSettingsModel.set('remoteApiKey', this.remoteApiKey.value);

      }

      // Emit event for other windows to update
      ipcRenderer.send('model-changed', option.type === 'local' ? { model: option.value, type: 'local' } : { model: option.value, type: 'remote', provider: option.provider });
    } finally {
      this.showModelMenu.value = false;
    }
  }

  private async loadRemoteSettings(): Promise<void> {
    this.remoteProvider.value = await SullaSettingsModel.get('remoteProvider', '');
    this.remoteModel.value = await SullaSettingsModel.get('remoteModel', '');
    this.remoteApiKey.value = await SullaSettingsModel.get('remoteApiKey', '');
  }

  private readonly handleDocumentClick = (ev: MouseEvent) => {
    if (!this.showModelMenu.value) {
      return;
    }
    const container = this.modelMenuEl.value;

    if (!container) {
      return;
    }
    // Don't hide if clicking on the toggle button
    if (ev.target === this.buttonRef.value || this.buttonRef.value?.contains(ev.target as Node)) {
      return;
    }
    if (ev.target instanceof Node && container.contains(ev.target)) {
      return;
    }

    this.showModelMenu.value = false;
  };

  // Silent fetch that doesn't log network errors to console
  private silentFetch(url: string, options: RequestInit = {}): Promise<Response | null> {
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
        }, 3000); // Default 3s timeout

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
        xhr.timeout = 3000; // Default timeout
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
  }

  private async refreshInstalledLocalModels(): Promise<void> {
    this.loadingLocalModels.value = true;
    try {
      const res = await this.silentFetch('http://127.0.0.1:30114/api/tags', {
        signal: AbortSignal.timeout(3000),
      });

      if (!res || !res.ok) {
        this.installedLocalModels.value = [];
        return;
      }

      const data = await res.json();
      const models = (data.models || []).map((m: { name: string }) => m.name);
      
      // Ensure Qwen3-ASR-0.6B is always available as an option
      if (!models.includes('Qwen3-ASR-0.6B')) {
        models.push('Qwen3-ASR-0.6B');
      }
      
      this.installedLocalModels.value = models;
    } catch {
      this.installedLocalModels.value = [];
    } finally {
      this.loadingLocalModels.value = false;
    }
  }
}
