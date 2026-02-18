// registry.ts (or wherever you centralize registrations)
import * as window from '@pkg/window';
import { SullaSettingsModel } from '@pkg/agent/database/models/SullaSettingsModel';
import { getIntegrationService } from './agent/services/IntegrationService';
import { getSchedulerService } from '@pkg/agent/services/SchedulerService';
import { getHeartbeatService } from '@pkg/agent/services/HeartbeatService';
import { getBackendGraphWebSocketService } from '@pkg/agent/services/BackendGraphWebSocketService';
import { SullaIntegrations } from './agent/integrations';
import { postgresClient } from '@pkg/agent/database/PostgresClient';
import { getChatCompletionsServer } from '@pkg/main/chatCompletionsServer';
import { createN8nService } from './agent/services/N8nService';
import { VectorBaseModel } from '@pkg/agent/database/VectorBaseModel';
import { getDatabaseManager } from '@pkg/agent/database/DatabaseManager';
import { initSullaEvents } from '@pkg/main/sullaEvents';
import { getExtensionService } from '@pkg/agent/services/ExtensionService';
import * as path from 'path';
import { app } from 'electron';
import { execSync } from 'child_process';

const checkDockerMode = async () => {
  try {
    let resourcesPath;
    if (process.resourcesPath.includes('node_modules/electron')) {
      // Development: use source resources
      resourcesPath = path.join(__dirname, '../../../resources');
    } else {
      // Production: use app resources
      resourcesPath = process.resourcesPath;
    }
    const limactlPath = path.join(resourcesPath, 'darwin/lima/bin/limactl');
    const output = execSync(`LIMA_HOME=~/Library/Application\\ Support/rancher-desktop/lima "${limactlPath}" list --json`, { encoding: 'utf8' });
    const instances = JSON.parse(output);
    const instance = instances.find((i: any) => i.name === '0');
    const vmRunning = instance?.status === 'Running';

    // Check if Kubernetes is enabled
    const k8sEnabled = await SullaSettingsModel.get('kubernetes.enabled', false);

    // We're in Docker mode if VM is not running OR Kubernetes is not enabled
    return !vmRunning || !k8sEnabled;
  } catch (err) {
    // If we can't check, assume Docker mode (VM not accessible)
    return true;
  }
};

export async function initiateWindowContext(): Promise<void> {
    // This function serves as the explicit initialization hook
    console.log('[WindowContext] Sulla window context initialized');

    // Get the user data path from main process
    const { ipcRenderer } = require('electron');
    try {
        const userDataPath = await ipcRenderer.invoke('get-user-data-path');
        const fallbackPath = require('path').join(userDataPath, 'sulla-settings-fallback.json');
        SullaSettingsModel.setFallbackFilePath(fallbackPath);
        console.log('[WindowContext] Fallback path set to:', fallbackPath);

        await SullaSettingsModel.bootstrap();
    } catch (error) {
        console.error('[WindowContext] Failed to initialize settings:', error);
    }

}

/**
 * Initialize all Sulla integrations
 * 
 * This function is called during application startup to set up all integration factories
 * 
 * @see sulla-desktop/background.ts
 */
export async function instantiateSullaStart(): Promise<void> {
    // Integration factories are already registered above
    // This function serves as the explicit initialization hook
    console.log('[Integrations] Sulla integrations initialized');

    try {

        await VectorBaseModel.vectorDB.initializeEmbeddings();

        const backendGraphWebSocketService = getBackendGraphWebSocketService();
        console.log('[Background] BackendGraphWebSocketService initialized - backend agent messages will be processed');

        // Initialize Sulla-specific IPC handlers
        initSullaEvents();
        
        // PG connection issue
        process.on('unhandledRejection', (reason: any) => {
            if (reason?.code === '57P01') {
                console.warn('[Unhandled] Ignored Postgres admin termination');
                return;
            }
            console.error('[Unhandled Rejection]', reason);
        });


        await afterBackgroundLoaded();

        const schedulerService = getSchedulerService();
        await schedulerService.initialize();
        console.log('[Background] SchedulerService initialized - calendar events will trigger in background');

        const heartbeatService = getHeartbeatService();
        await heartbeatService.initialize();
        console.log('[Background] HeartbeatService initialized - periodic tasks will run in background');

        const integrationService = getIntegrationService();
        await integrationService.initialize();
        console.log('[Background] IntegrationService initialized - integration tasks will run in background');

        // Start the chat completions API server
        console.log('[Background] Starting chat completions API server...');
        try {
            console.log('[Background] Chat completions server instance created');
            const chatServer = getChatCompletionsServer();
            await chatServer.start();
            console.log('[Background] Chat completions API server started successfully');
        } catch (error) {
            console.error('[Background] Failed to start chat completions API server:', error);
        }

        SullaIntegrations();

        httpCommandServer = new HttpCommandServer(new BackgroundCommandWorker());
            await httpCommandServer.init();
            await httpCredentialHelperServer.init();

        const extensionService = getExtensionService();
        await extensionService.initialize();
        console.log('[Background] ExtensionService initialized');

    } catch (ex: any) {
        console.error('[Background] Failed to initialize Sulla:', ex);
    }
}

/**
 * 
 * @see sulla-desktop/background.ts
 */
export async function onMainProxyLoad(ipcMainProxy: any) {

    // Assume main process
    const fallbackPath = path.join(app.getPath('userData'), 'sulla-settings-fallback.json');
    SullaSettingsModel.setFallbackFilePath(fallbackPath);
    SullaSettingsModel.set('pathUserData', app.getPath('userData'), 'string');

    // Cache it in settings on first request
    ipcMainProxy.handle('get-user-data-path', async () => {
        return app.getPath('userData');
    });

    // Handle app quit requests from the UI
    ipcMainProxy.handle('app-quit', async () => {
        console.log('[Sulla] Quitting application...');
        const firstRunWindow = window.getWindow('first-run');
        if (firstRunWindow) {
            firstRunWindow.setClosable(true);
            firstRunWindow.close();
        }

        // Stop Docker containers early if in Docker mode
        if (await checkDockerMode()) {
          try {
            const composeFilePath = path.join(process.cwd(), 'pkg/rancher-desktop/assets/sulla-docker-compose.yaml');
            execSync(`docker-compose -f "${composeFilePath}" down`, { cwd: process.cwd(), stdio: 'inherit' });
            console.log('[Shutdown] Local Docker containers stopped');
          } catch (err) {
            console.warn('[Shutdown] Docker compose down failed:', err);
          }
        }

        app.quit();
    });
}

/**
 * 
 * @see sulla-desktop/background.ts
 */
export async function afterBackgroundLoaded() {

    // Then initialize database manager
    const dbManager = getDatabaseManager();
    await dbManager.initialize().catch((err: any) => {
        // Make database initialization errors quieter during startup
        if (err.message && err.message.includes('Postgres not connected')) {
            console.debug('[Background] Database not ready yet (PostgreSQL not available)');
        } else {
            console.error('[Background] DatabaseManager failed to initialize:', err);
        }
    });

    // This initializes N8nService
    const n8nService = await createN8nService();
}

/**
 * Application shutdown graceful commands
 * 
 * @see sulla-desktop/background.ts
 */
export function hookSullaEnd(Electron: any, mainEvents: any, window:any) {

    mainEvents.on('sulla-first-run-complete', () => {
        const firstRunWindow = window.getWindow('first-run');
        firstRunWindow?.setClosable(true);
        firstRunWindow?.close();
        window.openMain();
    });

    app.on('will-quit', async () => {
        try {
            await getDatabaseManager().stop();
            console.log('[Shutdown] Postgres closed');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.warn('[Shutdown] Postgres close failed:', errorMessage);
        }

        // Stop Docker containers if in Docker mode
        if (await checkDockerMode()) {
          try {
            const composeFilePath = path.join(process.cwd(), 'pkg/rancher-desktop/assets/sulla-docker-compose.yaml');
            execSync(`docker-compose -f "${composeFilePath}" down`, { cwd: process.cwd(), stdio: 'inherit' });
            console.log('[Shutdown] Docker containers stopped');
          } catch (err) {
            console.warn('[Shutdown] Docker compose down failed:', err);
          }
        }
    });

    Electron.app.on('before-quit', async () => {
        try {
            await getDatabaseManager().stop();
            // Stop Docker containers if in Docker mode
            if (await checkDockerMode()) {
              try {
                const composeFilePath = path.join(process.cwd(), 'pkg/rancher-desktop/assets/sulla-docker-compose.yaml');
                execSync(`docker-compose -f "${composeFilePath}" down`, { cwd: process.cwd(), stdio: 'inherit' });
                console.log('[Shutdown] Docker containers stopped');
              } catch (err) {
                console.warn('[Shutdown] Docker compose down failed:', err);
              }
            }
        } catch { } // swallow any remaining errors
    });

    process.on('SIGTERM', async () => {
        await postgresClient.end();
        app.quit();
    });
    process.on('SIGINT', async () => {
        await postgresClient.end();
        app.quit();
    });
}

/**
 * 
 * @see sulla-desktop/background.ts
 */
export async function sullaEnd(event: any) {
    try {
        const chatServer = getChatCompletionsServer();
        chatServer.stop();
    } catch (error) {
        console.error('[Background] Error stopping chat completions server:', error);
    }
};