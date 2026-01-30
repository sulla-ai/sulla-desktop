import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import { ipcRenderer } from '@pkg/utils/ipcRenderer';

export class StartupProgressController {
  static createState(): {
    systemReady: Ref<boolean>;
    progressCurrent: Ref<number>;
    progressMax: Ref<number>;
    progressDescription: Ref<string>;
    startupPhase: Ref<string>;

    modelDownloading: Ref<boolean>;
    modelName: Ref<string>;
    modelDownloadProgress: Ref<number>;
    modelDownloadTotal: Ref<number>;
    modelDownloadStatus: Ref<string>;

    modelMode: Ref<'local' | 'remote'>;
    progressPercent: ComputedRef<number>;
  } {
    const progressCurrent = ref(0);
    const progressMax = ref(-1);

    return {
      systemReady:         ref(false),
      progressCurrent,
      progressMax,
      progressDescription: ref(''),
      startupPhase:        ref('initializing'),

      modelDownloading:    ref(false),
      modelName:           ref(''),
      modelDownloadProgress: ref(0),
      modelDownloadTotal:  ref(0),
      modelDownloadStatus: ref(''),

      modelMode:           ref<'local' | 'remote'>('local'),

      progressPercent: computed(() => {
        if (progressMax.value <= 0) {
          return 0;
        }

        return Math.round((progressCurrent.value / progressMax.value) * 100);
      }),
    };
  }

  private readonly OLLAMA_BASE = 'http://127.0.0.1:30114';
  private readinessInterval: ReturnType<typeof setInterval> | null = null;
  private k8sReady = false;

  private ollamaRestarting: Ref<boolean>;
  private memoryErrorCount: Ref<number>;
  private MAX_MEMORY_ERROR_RETRIES: number;

  constructor(private readonly state: {
    systemReady: Ref<boolean>;
    progressCurrent: Ref<number>;
    progressMax: Ref<number>;
    progressDescription: Ref<string>;
    startupPhase: Ref<string>;

    modelDownloading: Ref<boolean>;
    modelName: Ref<string>;
    modelDownloadProgress: Ref<number>;
    modelDownloadTotal: Ref<number>;
    modelDownloadStatus: Ref<string>;

    modelMode: Ref<'local' | 'remote'>;
  }) {
    this.ollamaRestarting = { value: false } as Ref<boolean>;
    this.memoryErrorCount = { value: 0 } as Ref<number>;
    this.MAX_MEMORY_ERROR_RETRIES = 3;
  }

  start(): void {
    ipcRenderer.on('k8s-progress', this.handleProgress);
    this.startReadinessCheck();
  }

  dispose(): void {
    ipcRenderer.removeListener('k8s-progress', this.handleProgress);

    if (this.readinessInterval) {
      clearInterval(this.readinessInterval);
      this.readinessInterval = null;
    }
  }

  setMemoryErrorRefs(params: {
    ollamaRestarting: Ref<boolean>;
    memoryErrorCount: Ref<number>;
    maxRetries?: number;
  }): void {
    this.ollamaRestarting = params.ollamaRestarting;
    this.memoryErrorCount = params.memoryErrorCount;
    if (typeof params.maxRetries === 'number') {
      this.MAX_MEMORY_ERROR_RETRIES = params.maxRetries;
    }
  }

  async handleOllamaMemoryError(errorMessage: string): Promise<boolean> {
    if (!errorMessage.includes('requires more system memory')) {
      return false;
    }

    this.memoryErrorCount.value++;
    console.warn(`[Agent] Ollama memory error detected (${this.memoryErrorCount.value}/${this.MAX_MEMORY_ERROR_RETRIES})`);

    if (this.memoryErrorCount.value >= this.MAX_MEMORY_ERROR_RETRIES) {
      console.error('[Agent] Max memory error retries exceeded');
      return false;
    }

    if (this.ollamaRestarting.value) {
      return true;
    }

    this.ollamaRestarting.value = true;
    this.updateStartupStatus('recovery', 'Restarting Ollama to free memory...');

    try {
      await ipcRenderer.invoke('sulla-restart-ollama');
      console.log('[Agent] Ollama restart requested');

      this.updateStartupStatus('recovery', 'Waiting for Ollama to restart...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      this.ollamaRestarting.value = false;
      this.state.systemReady.value = false;
      this.startReadinessCheck();
      return true;
    } catch (err) {
      console.error('[Agent] Failed to restart Ollama:', err);
      this.ollamaRestarting.value = false;
      return false;
    }
  }

  updateStartupStatus(phase: string, detail: string): void {
    this.state.startupPhase.value = phase;
    this.state.progressDescription.value = detail;
  }

  async initializeFromBackend(): Promise<void> {
    try {
      const progress = await ipcRenderer.invoke('k8s-progress');

      if (progress) {
        this.state.progressCurrent.value = progress.current;
        this.state.progressMax.value = progress.max;
        this.state.progressDescription.value = progress.description || 'Initializing...';

        if (progress.max > 0 && progress.current >= progress.max) {
          this.k8sReady = true;
        }
      }
    } catch {
      // ignore
    }
  }

  private startReadinessCheck(): void {
    if (this.readinessInterval) {
      clearInterval(this.readinessInterval);
      this.readinessInterval = null;
    }

    this.readinessInterval = setInterval(async () => {
      if (!this.k8sReady) {
        if (this.state.progressMax.value > 0 && this.state.progressCurrent.value >= this.state.progressMax.value) {
          this.k8sReady = true;
        } else {
          return;
        }
      }

      const ollamaUp = await this.checkOllamaConnectivity();

      if (!ollamaUp) {
        this.updateStartupStatus('pods', 'Waiting for Ollama pod to start...');
        return;
      }

      if (this.state.modelMode.value === 'local') {
        const targetModel = this.state.modelName.value || 'tinyllama:latest';
        this.updateStartupStatus('model', `Checking for AI model (${targetModel})...`);
        const hasModel = await this.checkOllamaModel(targetModel);

        if (!hasModel) {
          if (!this.state.modelDownloading.value) {
            this.updateStartupStatus('model', `Downloading ${targetModel}...`);
            void this.pullModelWithProgress(targetModel);
          }
          return;
        }
      } else {
        this.updateStartupStatus('model', `Using remote model: ${this.state.modelName.value}`);
      }

      this.updateStartupStatus('ready', 'System ready!');
      this.state.systemReady.value = true;

      if (this.readinessInterval) {
        clearInterval(this.readinessInterval);
        this.readinessInterval = null;
      }
    }, 2000);
  }

  private readonly handleProgress = (_event: unknown, progress: { current: number; max: number; description?: string }) => {
    this.state.progressCurrent.value = progress.current;
    this.state.progressMax.value = progress.max;

    if (this.state.startupPhase.value === 'initializing' || this.state.startupPhase.value === 'k8s') {
      this.state.progressDescription.value = progress.description || 'Starting Kubernetes...';
      this.state.startupPhase.value = 'k8s';
    }
  };

  private async checkOllamaConnectivity(): Promise<boolean> {
    try {
      const res = await fetch(`${this.OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async checkOllamaModel(targetModel: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.OLLAMA_BASE}/api/tags`);

      if (res.ok) {
        const data = await res.json();
        const modelNames = data.models?.map((m: { name: string }) => m.name) || [];

        if (modelNames.includes(targetModel)) {
          return true;
        }

        const baseModel = targetModel.split(':')[0];
        if (modelNames.some((name: string) => name.startsWith(baseModel))) {
          return true;
        }
      }
    } catch {
      // ignore
    }

    return false;
  }

  private async pullModelWithProgress(targetModel: string): Promise<boolean> {
    this.state.modelDownloading.value = true;
    this.state.modelName.value = targetModel;
    this.state.modelDownloadStatus.value = 'Starting download...';
    this.state.modelDownloadProgress.value = 0;
    this.state.modelDownloadTotal.value = 0;

    try {
      const res = await fetch(`${this.OLLAMA_BASE}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: targetModel, stream: true }),
      });

      if (!res.ok || !res.body) {
        this.state.modelDownloadStatus.value = 'Download failed';
        this.state.modelDownloading.value = false;
        return false;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);

            if (data.status) {
              this.state.modelDownloadStatus.value = data.status;
            }

            if (data.total && data.completed !== undefined) {
              this.state.modelDownloadTotal.value = data.total;
              this.state.modelDownloadProgress.value = data.completed;
            }

            if (data.status === 'success') {
              this.state.modelDownloadStatus.value = 'Download complete!';
              this.state.modelDownloading.value = false;
              return true;
            }
          } catch {
            // ignore
          }
        }
      }

      this.state.modelDownloading.value = false;
      return true;
    } catch (err) {
      console.error('[Agent] Model pull failed:', err);
      this.state.modelDownloadStatus.value = 'Download failed';
      this.state.modelDownloading.value = false;
      return false;
    }
  }
}
