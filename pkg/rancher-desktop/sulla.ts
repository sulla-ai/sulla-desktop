// registry.ts (or wherever you centralize registrations)
import { getIntegrationService } from './agent/services/IntegrationService';
import { getSchedulerService } from '@pkg/agent/services/SchedulerService';
import { getHeartbeatService } from '@pkg/agent/services/HeartbeatService';
import { getBackendGraphWebSocketService } from '@pkg/agent/services/BackendGraphWebSocketService';
import { SullaIntegrations } from './agent/integrations';
import { postgresClient } from '@pkg/agent/database/PostgresClient';
import { getChatCompletionsServer } from '@pkg/main/chatCompletionsServer';

import { app } from 'electron';
const { getDatabaseManager } = require('@pkg/agent/database/DatabaseManager');
import { initSullaEvents } from '@pkg/main/sullaEvents';



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
        const schedulerService = getSchedulerService();
        await schedulerService.initialize();
        console.log('[Background] SchedulerService initialized - calendar events will trigger in background');

        const heartbeatService = getHeartbeatService();
        await heartbeatService.initialize();
        console.log('[Background] HeartbeatService initialized - periodic tasks will run in background');

        const integrationService = getIntegrationService();
        await integrationService.initialize();
        console.log('[Background] IntegrationService initialized - integration tasks will run in background');

        const backendGraphWebSocketService = getBackendGraphWebSocketService();
        console.log('[Background] BackendGraphWebSocketService initialized - backend agent messages will be processed');

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

    } catch (ex: any) {
        console.error('[Background] Failed to initialize cron services:', ex);
    }
}

/**
 * 
 * @see sulla-desktop/background.ts
 */
export async function onMainProxyLoad(ipcMainProxy: any) {

    // Handle agent configuration updates from renderer process
    ipcMainProxy.on('agent-config-updated', (event: any, agentConfig: any) => {
        console.log('[Background] Agent configuration updated from renderer');
        // Update the agent services with new configuration
        try {
            const { updateAgentConfigFull } = require('@pkg/agent/services/ConfigService');
            updateAgentConfigFull(agentConfig);
        } catch (err) {
            console.warn('[Background] Failed to update agent config from renderer:', err);
        }
    });
}

/**
 * 
 * @see sulla-desktop/background.ts
 */
export async function afterBackgroundLoaded() {

    // After all background services are initialized
    const dbManager = getDatabaseManager();
    await dbManager.initialize().catch((err: any) => {
        // Make database initialization errors quieter during startup
        if (err.message && err.message.includes('Postgres not connected')) {
            console.debug('[Background] Database not ready yet (PostgreSQL not available)');
        } else {
            console.error('[Background] DatabaseManager failed to initialize:', err);
        }
    });
}

/**
 * Application shutdown graceful commands
 * 
 * @see sulla-desktop/background.ts
 */
export function hookSullaEnd(Electron:any) {

    app.on('will-quit', async () => {
        try {
            await getDatabaseManager().stop();
            console.log('[Shutdown] Postgres closed');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.warn('[Shutdown] Postgres close failed:', errorMessage);
        }
    });

    Electron.app.on('before-quit', async () => {
        try {
            await getDatabaseManager().stop();
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