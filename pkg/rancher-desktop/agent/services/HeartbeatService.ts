// HeartbeatService - Triggers periodic sensory input for the agent to check in
// Uses setInterval for simple periodic scheduling based on config settings

import { getSensory } from '../SensoryInput';
import { getContextDetector } from '../ContextDetector';
import { getThread } from '../ConversationThread';
import { getPlanService } from './PlanService';

const HEARTBEAT_THREAD_ID = 'heartbeat-background';

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
  private config: HeartbeatConfig = {
    enabled: true,
    delayMinutes: 30,
    prompt: 'This is the time for you to accomplish your goals',
    model: 'default',
  };

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[HeartbeatService] Initializing...');
    this.initialized = true;

    // Start the heartbeat if enabled
    if (this.config.enabled) {
      this.startHeartbeat();
    }
  }

  updateConfig(config: Partial<HeartbeatConfig>): void {
    const wasEnabled = this.config.enabled;
    const oldDelay = this.config.delayMinutes;

    if (config.enabled !== undefined) {
      this.config.enabled = config.enabled;
    }
    if (config.delayMinutes !== undefined) {
      this.config.delayMinutes = config.delayMinutes;
    }
    if (config.prompt !== undefined) {
      this.config.prompt = config.prompt;
    }
    if (config.model !== undefined) {
      this.config.model = config.model;
    }

    console.log(`[HeartbeatService] Config updated: enabled=${this.config.enabled}, delay=${this.config.delayMinutes}min, model=${this.config.model}`);

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

  private async triggerHeartbeat(): Promise<void> {
    try {
      // Check if there's an active plan - skip heartbeat if so
      const planService = getPlanService();
      const activePlans = await planService.getActivePlans();
      if (activePlans.length > 0) {
        console.log(`[HeartbeatService] ⏭️ Skipping heartbeat - ${activePlans.length} active plan(s) in progress`);
        return;
      }

      console.log(`[HeartbeatService] 📤 Sending event to SensoryInput`);

      const sensory = getSensory();
      const contextDetector = getContextDetector();

      // Create a heartbeat-triggered sensory input
      const prompt = this.buildHeartbeatPrompt();
      console.log(`[HeartbeatService]   Built prompt (${prompt.length} chars)`);

      const input = sensory.createHeartbeatInput(prompt);
      console.log(`[HeartbeatService]   Created SensoryInput: type=${input.type}`);
      console.log(`[HeartbeatService]   Model override: ${this.config.model}`);

      // Add model override to input metadata if not 'default'
      if (this.config.model !== 'default') {
        input.metadata.heartbeatModel = this.config.model;
      }

      // Detect context (will use heartbeat thread)
      const threadContext = await contextDetector.detect(input, HEARTBEAT_THREAD_ID);
      console.log(`[HeartbeatService]   Context detected: threadId=${threadContext.threadId}`);

      // Get or create the heartbeat thread
      const thread = getThread(threadContext.threadId);
      await thread.initialize();
      console.log(`[HeartbeatService]   Thread initialized, processing input...`);

      // Process the heartbeat
      const response = await thread.process(input);

      console.log(`[HeartbeatService] ✅ Heartbeat processed successfully`);
      console.log(`[HeartbeatService]   Response (first 200 chars): ${response.content.substring(0, 200)}...`);
    } catch (err) {
      console.error(`[HeartbeatService] ❌ Failed to trigger heartbeat:`, err);
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

    return `[HEARTBEAT NOTIFICATION]

Current time: ${formattedTime}
Timezone: ${timezone}

${this.config.prompt}`;
  }

  getConfig(): HeartbeatConfig {
    return { ...this.config };
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }

  destroy(): void {
    this.stopHeartbeat();
    this.initialized = false;
  }
}
