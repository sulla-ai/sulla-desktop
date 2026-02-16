import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import { ipcRenderer } from '@pkg/utils/ipcRenderer';
import type { IpcRendererEvent } from 'electron';

import { getLocalService } from '../../agent/languagemodels';

export class StartupProgressController {

  private readonly OLLAMA_BASE = 'http://127.0.0.1:30114';
  private readinessInterval: ReturnType<typeof setInterval> | null = null;
  private k8sReady = false;

  /**
   * 
   */
  static createState() {
    const progressCurrent = ref(0);
    const progressMax = ref(100); // Start at 100 so overlay shows immediately

    return {
      systemReady:         ref(false),
      progressCurrent,
      progressMax,
      progressDescription: ref('Starting Sulla...'),
      startupPhase:        ref('initializing'),
      showOverlay:         ref(false), // Controls overlay visibility

      modelDownloading:    ref(false),
      modelName:           ref(''),
      modelDownloadStatus: ref(''),

      modelMode:           ref<'local' | 'remote'>('local'),
    };
  }

  /**
   * 
   * @param state 
   */
  constructor(public readonly state: ReturnType<typeof StartupProgressController.createState>) {}

  /**
   * 
   */
  start(): void {
    console.log('[StartupProgressController] start() called');
    // Check if we've seen the startup splash in this session
    const hasSeenSplash = sessionStorage.getItem('sulla-startup-splash-seen') === 'true';
    
    // If not seen, show overlay immediately on new bootup
    if (!hasSeenSplash) {
      this.state.showOverlay.value = true;
    }
    
    // Initialize overlay state immediately so popup shows right away
    this.state.progressMax.value = 100;
    this.state.progressCurrent.value = 0;
    console.log('[StartupProgressController] initial state: progressMax=', this.state.progressMax.value, 'progressCurrent=', this.state.progressCurrent.value);
    this.state.progressDescription.value = 'Initializing...';
    this.state.systemReady.value = false;
    
    // Listen for main process restart to show overlay
    ipcRenderer.on('sulla-main-started' as any, this.handleMainStarted);
    
    ipcRenderer.on('k8s-progress', this.handleProgress);

    // Use type assertion until you extend IpcRendererEvents
    ipcRenderer.on('ollama-model-status' as any, this.handleOllamaModelStatus);

    this.startReadinessCheck();
  }

  /**
   * 
   * @param event 
   * @param payload 
   */
  private readonly handleOllamaModelStatus = (event: IpcRendererEvent, payload: unknown) => {
    console.log('[StartupProgressController] ollama-model-status:', payload);
    // Safely narrow the payload
    if (payload && typeof payload === 'object' && 'status' in payload) {
      const typedPayload = payload as { status: string; model?: string };
      this.state.modelDownloading.value =
        typedPayload.status.includes('Downloading') ||
        typedPayload.status.includes('pulling') ||
        typedPayload.status.includes('Extracting');

      this.state.modelName.value = typedPayload.model || this.state.modelName.value;
      this.state.modelDownloadStatus.value = typedPayload.status;

      // Show overlay if model is downloading
      if (this.state.modelDownloading.value && this.state.progressMax.value <= 0) {
        this.state.progressMax.value = 100;
        this.state.progressCurrent.value = 0;
        this.state.progressDescription.value = 'Downloading model...';
      }

      // Show overlay on any model status event
      this.state.showOverlay.value = true;

      if (typedPayload.status === 'success' || typedPayload.status.includes('complete')) {
        this.state.modelDownloading.value = false;
        this.state.modelDownloadStatus.value = 'Model ready';
      }
    }
  };

  dispose(): void {
    ipcRenderer.removeListener('sulla-main-started' as any, this.handleMainStarted);
    ipcRenderer.removeListener('k8s-progress', this.handleProgress);
    ipcRenderer.removeListener('ollama-model-status' as any, this.handleOllamaModelStatus);

    if (this.readinessInterval) {
      clearInterval(this.readinessInterval);
      this.readinessInterval = null;
    }
  }

  private readonly handleModelStatus = (
    event: IpcRendererEvent,
    payload: { status: string; model?: string }
  ) => {
    this.state.modelDownloading.value =
      payload.status.includes('Downloading') ||
      payload.status.includes('pulling') ||
      payload.status.includes('Extracting');

    this.state.modelName.value = payload.model || this.state.modelName.value;
    this.state.modelDownloadStatus.value = payload.status;

    if (payload.status === 'success' || payload.status.includes('complete')) {
      this.state.modelDownloading.value = false;
      this.state.modelDownloadStatus.value = 'Model ready';
      this.state.showOverlay.value = false;
    }
  };

  private readonly handleProgress = (_: unknown, progress: { current: number; max: number; description?: string }) => {
    console.log('[StartupProgressController] handleProgress:', progress);
    // Show overlay on any progress event
    this.state.showOverlay.value = true;
    
    // If we got a real progress update, use those values instead of restart placeholder
    if (progress.max > 0) {
      this.state.progressCurrent.value = progress.current;
      this.state.progressMax.value = progress.max;
    } else if (progress.max === -1) {
      // Indeterminate progress, simulate by incrementing current
      this.state.progressCurrent.value = Math.min(this.state.progressCurrent.value + 10, this.state.progressMax.value);
    }
    this.state.progressDescription.value = progress.description || this.state.progressDescription.value;

    if (progress.description?.includes('Ollama') || progress.description?.includes('model')) {
      this.state.startupPhase.value = 'model';
    } else if (
      progress.description?.includes('Kubernetes') ||
      progress.description?.includes('deployment') ||
      progress.description?.includes('pod')
    ) {
      this.state.startupPhase.value = 'pods';
    } else {
      this.state.startupPhase.value = 'k8s';
    }

    if (progress.max > 0 && progress.current >= progress.max) {
      this.k8sReady = true;
    }
  };

  private readonly handleMainStarted = () => {
    console.log('[StartupProgressController] Main process restarted - showing overlay');
    this.state.showOverlay.value = true;

    // Set progressMax to trigger overlay display
    this.state.progressMax.value = 100;
    this.state.progressCurrent.value = 0;
    this.state.progressDescription.value = 'System restarting...';
    this.state.startupPhase.value = 'initializing';
    this.state.systemReady.value = false;
    this.k8sReady = false;
  };

  private startReadinessCheck(): void {
    this.readinessInterval = setInterval(async () => {
      if (!this.k8sReady) return;


      if (this.state.modelDownloading.value) {
        return; // model status already updating via event
      }

      this.state.startupPhase.value = 'ready';
      this.state.progressDescription.value = 'System ready!';
      this.state.systemReady.value = true;
      this.state.showOverlay.value = false; // Hide overlay when ready

      // Mark that we've seen the startup splash in this session
      sessionStorage.setItem('sulla-startup-splash-seen', 'true');

      clearInterval(this.readinessInterval!);
      this.readinessInterval = null;
    }, 3000);
  }

  private async pullNomicEmbedTextModel(): Promise<void> {
    try {
      console.log('[StartupProgressController] Checking for nomic-embed-text model...');

      // Get the local Ollama service
      const ollamaService = await getLocalService();
      if (!ollamaService) {
        console.warn('[StartupProgressController] No local Ollama service available, skipping nomic-embed-text check');
        return;
      }

      // Cast to OllamaService to access Ollama-specific methods
      const ollama = ollamaService as any; // OllamaService has refreshModels and hasModel methods

      // Refresh the model list to ensure we have the latest available models
      await ollama.refreshModels();

      // Check if the model is already available
      if (ollama.hasModel('nomic-embed-text')) {
        console.log('[StartupProgressController] nomic-embed-text model already available, skipping pull');
        return;
      }

      console.log('[StartupProgressController] nomic-embed-text model not found, pulling...');

      // Pull the model
      const success = await ollamaService!.pullModel('nomic-embed-text', (status: string) => {
        console.log(`[StartupProgressController] nomic-embed-text pull status: ${status}`);
      });

      if (success) {
        console.log('[StartupProgressController] Successfully pulled nomic-embed-text model');
      } else {
        console.warn('[StartupProgressController] Failed to pull nomic-embed-text model');
      }
    } catch (error) {
      console.error('[StartupProgressController] Error checking/pulling nomic-embed-text model:', error);
    }
  }
}