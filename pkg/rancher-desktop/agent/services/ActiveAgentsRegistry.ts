// ActiveAgentsRegistry.ts
// Redis-backed registry of all active agents and the channels they run on.
// Every agent registers itself when it starts and deregisters when it stops.
// The human is also tracked here (via HumanPresenceTracker).
// Any agent can read this registry to know who's running where.

import { redisClient } from '../database/RedisClient';

// ============================================================================
// TYPES
// ============================================================================

export interface ActiveAgent {
  agentId: string;
  channel: string;
  type: 'heartbeat' | 'frontend' | 'agent' | 'human';
  status: 'running' | 'idle' | 'offline';
  startedAt: number;
  lastActiveAt: number;
  description: string;
}

// ============================================================================
// REDIS KEY
// ============================================================================

const REGISTRY_HASH = 'sulla:active_agents';

// ============================================================================
// SERVICE
// ============================================================================

let registryInstance: ActiveAgentsRegistry | null = null;

export function getActiveAgentsRegistry(): ActiveAgentsRegistry {
  if (!registryInstance) {
    registryInstance = new ActiveAgentsRegistry();
  }
  return registryInstance;
}

export class ActiveAgentsRegistry {

  async register(agent: ActiveAgent): Promise<void> {
    await redisClient.hset(REGISTRY_HASH, agent.agentId, JSON.stringify(agent));
  }

  async deregister(agentId: string): Promise<void> {
    const client = redisClient.getClient();
    await client.hdel(REGISTRY_HASH, agentId);
  }

  async updateStatus(agentId: string, status: ActiveAgent['status']): Promise<void> {
    const existing = await this.getAgent(agentId);
    if (!existing) return;
    existing.status = status;
    existing.lastActiveAt = Date.now();
    await redisClient.hset(REGISTRY_HASH, agentId, JSON.stringify(existing));
  }

  async heartbeat(agentId: string): Promise<void> {
    const existing = await this.getAgent(agentId);
    if (!existing) return;
    existing.lastActiveAt = Date.now();
    await redisClient.hset(REGISTRY_HASH, agentId, JSON.stringify(existing));
  }

  async getAgent(agentId: string): Promise<ActiveAgent | null> {
    const raw = await redisClient.hget(REGISTRY_HASH, agentId);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async getAllAgents(): Promise<ActiveAgent[]> {
    const raw = await redisClient.hgetall(REGISTRY_HASH);
    const agents: ActiveAgent[] = [];
    for (const value of Object.values(raw)) {
      try {
        agents.push(JSON.parse(value));
      } catch {
        // skip malformed
      }
    }
    return agents;
  }

  async getChannelForAgent(agentId: string): Promise<string | null> {
    const agent = await this.getAgent(agentId);
    return agent?.channel || null;
  }

  async getAgentOnChannel(channel: string): Promise<ActiveAgent | null> {
    const agents = await this.getAllAgents();
    return agents.find(a => a.channel === channel) || null;
  }

  // ------------------------------------------------------------------
  // CONTEXT BUILDER — produces the environmental context block
  // ------------------------------------------------------------------

  async buildContextBlock(): Promise<string> {
    const agents = await this.getAllAgents();

    if (agents.length === 0) {
      return `## Active Agents & Channels\nNo agents currently registered.`;
    }

    // Also pull human presence summary
    let humanLine = '';
    try {
      const { getHumanHeartbeatBridge } = await import('./HumanHeartbeatBridge');
      const bridge = getHumanHeartbeatBridge();
      humanLine = await bridge.getPresenceSummary();
    } catch {
      humanLine = '**Jonathon (human):** presence unknown';
    }

    const lines = agents
      .filter(a => a.type !== 'human')
      .map(a => {
        const age = Math.floor((Date.now() - a.lastActiveAt) / 60000);
        return `- **${a.agentId}** (${a.type}) · channel: \`${a.channel}\` · ${a.status} · last active ${age}m ago · ${a.description}`;
      });

    const parts = [
      `## Active Agents & Channels`,
      ``,
      humanLine,
      ``,
      ...lines,
      ``,
      `To send a message to any agent or the human, use **send_channel_message** with the target channel.`,
      `The receiving agent will see your message and your sender ID so it knows where to reply.`,
    ];

    return parts.join('\n');
  }
}
