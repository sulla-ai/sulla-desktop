// registry.ts (or wherever you centralize registrations)
import { IntegrationRegistry } from './IntegrationRegistry';
import { getIntegrationService } from '../services/IntegrationService';
import { SlackClient, slackClient } from './slack/SlackClient';
import { getSchedulerService } from '@pkg/agent/services/SchedulerService';
import { getHeartbeatService } from '@pkg/agent/services/HeartbeatService';
import { getBackendGraphWebSocketService } from '@pkg/agent/services/BackendGraphWebSocketService';

export const registry = new IntegrationRegistry();

/**
 * Slack
 * 
 * 
 */
registry.register('slack', async () => {
  const svc = getIntegrationService();
  await svc.initialize(); // ensure DB tables

  // Check if Slack is activated before attempting initialization
  const connectionStatus = await svc.getConnectionStatus('slack');
  if (!connectionStatus.connected) {
    return null;
  }

  const botToken = (await svc.getIntegrationValue('slack', 'bot_token'))?.value;
  const appToken = (
    (await svc.getIntegrationValue('slack', 'scopes_token'))?.value ||
    (await svc.getIntegrationValue('slack', 'app_token'))?.value ||
    (await svc.getIntegrationValue('slack', 'app_level_token'))?.value
  );

  // Inject tokens if present (SlackClient will also resolve from DB/env fallback)
  if (botToken && appToken) {
    slackClient.setTokens(botToken, appToken);
  }

  const initialized = await slackClient.initialize();
  if (!initialized) {
    return null;
  }

  return slackClient;
});

/**
 * Initialize all Sulla integrations
 * This function is called during application startup to set up all integration factories
 */
export async function SullaIntegrations(): Promise<void> {
  // Integration factories are already registered above
  // This function serves as the explicit initialization hook
  console.log('[Integrations] Sulla integrations initialized');

  try {
    
    const slack = await registry.get<SlackClient>('slack');

  } catch (ex: any) {
    console.error('[Background] Failed to initialize cron services:', ex);
  }
}
