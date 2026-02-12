// HeartbeatService - Triggers periodic sensory input for the agent to check in
// Uses setInterval for simple periodic scheduling based on config settings

import type { OverlordThreadState } from '../nodes/Graph';
import { createHeartbeatGraph } from '../nodes/Graph';
import { getCurrentModel, getCurrentMode } from '../languagemodels';
import { SullaSettingsModel } from '../database/models/SullaSettingsModel';

export interface HeartbeatConfig {
  enabled: boolean;
  delayMinutes: number;
  prompt: string;
  model: string; // 'default' or specific model like 'local:tinyllama:latest' or 'remote:grok:grok-4-1-fast-reasoning'
}

let heartbeatServiceInstance: HeartbeatService | null = null;

export function getHeartbeatService(): HeartbeatService {
  if (!heartbeatServiceInstance) {
    heartbeatServiceInstance = new HeartbeatService();
  }
  return heartbeatServiceInstance;
}

export class HeartbeatService {
  private initialized = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isExecuting = false; // Track if heartbeat is actively executing
  private config: HeartbeatConfig = {
    enabled: false,
    delayMinutes: 30,
    prompt: '',
    model: 'default',
  };

  constructor() {
    // Settings are loaded on-demand from database
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[HeartbeatService] Initializing...');
    this.initialized = true;

    // Pull initial configuration
    await this.pullConfig();

    // Start the heartbeat if enabled
    if (this.config.enabled) {
      this.startHeartbeat();
    }
  }

  private async pullConfig(): Promise<void> {
    const wasEnabled = this.config.enabled;
    const oldDelay = this.config.delayMinutes;

    const rawDelay = await SullaSettingsModel.get('heartbeatDelayMinutes', 30);
    const safeDelay = isNaN(rawDelay) || rawDelay <= 0 ? 30 : Math.max(1, rawDelay);

    this.config = {
      enabled: await SullaSettingsModel.get('heartbeatEnabled', true),
      delayMinutes: safeDelay,
      prompt: await SullaSettingsModel.get('heartbeatPrompt', ''),
      model: await SullaSettingsModel.get('heartbeatModel', 'default'),
    };

    console.log(`[HeartbeatService] Config pulled: enabled=${this.config.enabled}, delay=${this.config.delayMinutes}min, model=${this.config.model}`);

    // Handle enable/disable or delay changes
    if (this.config.enabled !== wasEnabled || this.config.delayMinutes !== oldDelay) {
      this.stopHeartbeat();
      if (this.config.enabled) {
        this.startHeartbeat();
      }
    }
  }

  private startHeartbeat(): void {
    if (this.intervalId) {
      return; // Already running
    }

    const delayMs = this.config.delayMinutes * 60 * 1000;
    console.log(`[HeartbeatService] Starting heartbeat with ${this.config.delayMinutes} minute interval`);

    this.intervalId = setInterval(async () => {
      console.log(`[HeartbeatService] ⏰ HEARTBEAT TRIGGERED`);
      console.log(`[HeartbeatService]   Time: ${new Date().toISOString()}`);
      await this.triggerHeartbeat();
    }, delayMs);

    // Log next heartbeat time
    const nextHeartbeat = new Date(Date.now() + delayMs);
    console.log(`[HeartbeatService] Next heartbeat at: ${nextHeartbeat.toISOString()}`);
  }

  private stopHeartbeat(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[HeartbeatService] Heartbeat stopped');
    }
  }

  async refreshConfig(): Promise<void> {
    await this.pullConfig();
  }

  private async triggerHeartbeat(): Promise<void> {
    try {
      // Skip if heartbeat is already executing
      if (this.isExecuting) {
        console.log('[HeartbeatService] ⏭️ Skipping heartbeat - already executing');
        return;
      }

      // Mark as executing
      this.isExecuting = true;

      // Pull fresh config before each heartbeat
      await this.pullConfig();

      // Build the heartbeat prompt
      const prompt = this.buildHeartbeatPrompt();
      console.log(`[HeartbeatService] Built prompt \n${prompt})`);

      // Build a minimal ThreadState and execute nodes directly (skip Sensory/ContextDetector/ConversationThread)
      const now = Date.now();
      const threadId = `heartbeat_${ now }`;
      const state: OverlordThreadState = {
        messages:        [{
          role:      'user',
          content:   prompt,
          metadata:  { source: 'heartbeat' },
        }],
        metadata: {
          threadId,
          wsChannel: 'dreaming-protocol',
          cycleComplete: false,
          waitingForUser: false,
          llmModel: await this.getHeartbeatModel(),
          llmLocal: await this.isHeartbeatLocal(),
          options: {},
          currentNodeId: '',
          consecutiveSameNode: 0,
          iterations: 0,
          revisionCount: 0,
          maxIterationsReached: false,
          memory: {
            knowledgeBaseContext: '',
            chatSummariesContext: '',
          },
          subGraph: {
            state: 'completed',
            name: 'hierarchical',
            prompt: '',
            response: '',
          },
          finalSummary: '',
          finalState: 'running',
          returnTo: null,
          primaryProject: '',
          projectDescription: '',
          projectGoals: [],
          projectState: 'continue',
        },
      };

      console.log(`[HeartbeatService] 🧠 Executing heartbeat graph (OverLord → HierarchicalGraph → OverLord) (threadId=${threadId})`);
      const graph = createHeartbeatGraph();
      await graph.execute(state);

      console.log(`[HeartbeatService] ✅ Heartbeat graph executed successfully`);
    } catch (err) {
      console.error(`[HeartbeatService] ❌ Failed to trigger heartbeat:`, err);
    } finally {
      // Always reset executing flag
      this.isExecuting = false;
    }
  }

  private buildHeartbeatPrompt(): string {
    const now = new Date();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const formattedTime = now.toLocaleString('en-US', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    return `\nCurrent time: ${formattedTime}\nTimezone: ${timezone}\n\n${this.config.prompt}`;
  }

  getConfig(): HeartbeatConfig {
    return { ...this.config };
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Parse the heartbeat model configuration and return the model name
   * Format: 'default', 'local:modelname', or 'remote:provider:modelname'
   */
  private async getHeartbeatModel(): Promise<string> {
    if (this.config.model === 'default') {
      return await getCurrentModel();
    }

    const parts = this.config.model.split(':');
    if (parts.length === 2 && parts[0] === 'local') {
      return parts[1]; // local:modelname
    } else if (parts.length >= 3 && parts[0] === 'remote') {
      return parts.slice(2).join(':'); // remote:provider:modelname (handle model names with colons)
    }

    // Fallback to current model if format is unexpected
    return await getCurrentModel();
  }

  /**
   * Determine if the heartbeat is configured to use local or remote
   */
  private async isHeartbeatLocal(): Promise<boolean> {
    if (this.config.model === 'default') {
      return (await getCurrentMode()) === 'local';
    }

    return this.config.model.startsWith('local:');
  }

  destroy(): void {
    this.stopHeartbeat();
    this.initialized = false;
  }
}
