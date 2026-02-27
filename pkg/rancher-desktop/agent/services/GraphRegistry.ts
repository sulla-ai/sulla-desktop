import { Graph, createOverlordGraph, createAgentGraph, OverlordThreadState, BaseThreadState, AgentGraphState, GeneralGraphState } from '../nodes/Graph';
import { SullaSettingsModel } from '../database/models/SullaSettingsModel';
import { getCurrentModel, getCurrentMode } from '../languagemodels';

// Side-effect: ensure tool manifests are registered before any graph runs
import '../tools/manifests';

const registry = new Map<string, {
  graph: Graph<any>;
  state: BaseThreadState;
}>();

export const GraphRegistry = {
  /**
   * Get existing graph for thread, or create new if not found.
   */
  get(threadId: string): {
    graph: Graph<any>;
    state: BaseThreadState;
  } | null {
    return registry.get(threadId) ?? null;
  },

  /**
   * Create a brand new graph + state (always fresh threadId).
   * Use when user explicitly wants "New Conversation".
   */
  createNew: async function(wsChannel: string): Promise<{
    graph: Graph<any>;
    state: BaseThreadState;
    threadId: string;
  }> {
    const threadId = nextThreadId();
    const graph = createAgentGraph();
    const state = await buildAgentState(wsChannel, threadId);

    registry.set(threadId, { graph, state });
    return { graph, state, threadId };
  },

  /**
   * Get or create Overlord graph.
   */
  getOrCreateOverlordGraph: async function(wsChannel: string, prompt?: string): Promise<{
    graph: Graph<OverlordThreadState>;
    state: BaseThreadState;
  }> {
    if (registry.has(wsChannel)) {
      return Promise.resolve(registry.get(wsChannel)!);
    }

    const graph = createOverlordGraph();
    const state = await buildOverlordState(wsChannel, prompt ?? '');

    registry.set(wsChannel, { graph, state });
    return { graph, state };
  },

  /**
   * Get or create AgentGraph — the standard graph for all tasks.
   */
  getOrCreate: async function(wsChannel: string, threadId: string): Promise<{
    graph: Graph<AgentGraphState>;
    state: AgentGraphState;
  }> {
    if (registry.has(threadId)) {
      return Promise.resolve(registry.get(threadId)!);
    }

    const graph = createAgentGraph();
    const state = await buildAgentState(wsChannel, threadId);

    registry.set(threadId, { graph, state });
    return { graph, state };
  },

  // Aliases — all point to AgentGraph now
  getOrCreateSkillGraph: async function(wsChannel: string, threadId: string) {
    return this.getOrCreate(wsChannel, threadId);
  },

  getOrCreateAgentGraph: async function(wsChannel: string, threadId: string) {
    return this.getOrCreate(wsChannel, threadId);
  },

  getOrCreateGeneralGraph: async function(wsChannel: string, threadId: string) {
    return this.getOrCreate(wsChannel, threadId);
  },

  delete(threadId: string): void {
    registry.delete(threadId);
  },

  clearAll(): void {
    registry.clear();
  },

  updateRuntimeFlags(threadId: string, flags: { n8nLiveEventsEnabled?: boolean }): boolean {
    const record = registry.get(threadId);
    if (!record) {
      return false;
    }

    if (typeof flags.n8nLiveEventsEnabled === 'boolean') {
      (record.state.metadata as any).n8nLiveEventsEnabled = flags.n8nLiveEventsEnabled;
    }

    return true;
  },

  updateRuntimeFlagsByStateThreadId(threadId: string, flags: { n8nLiveEventsEnabled?: boolean }): number {
    let updatedCount = 0;

    for (const record of registry.values()) {
      const stateThreadId = String((record.state.metadata as any)?.threadId || '').trim();
      if (!stateThreadId || stateThreadId !== threadId) {
        continue;
      }

      if (typeof flags.n8nLiveEventsEnabled === 'boolean') {
        (record.state.metadata as any).n8nLiveEventsEnabled = flags.n8nLiveEventsEnabled;
      }

      updatedCount += 1;
    }

    return updatedCount;
  }
};

let threadCounter = 0;
let messageCounter = 0;

export function nextThreadId(): string {
  return `thread_${Date.now()}_${++threadCounter}`;
}

export function nextMessageId(): string {
  return `msg_${Date.now()}_${++messageCounter}`;
}

async function buildOverlordState(wsChannel: string, prompt: string): Promise<OverlordThreadState> {
  let heartbeartModeheal = await SullaSettingsModel.get('heartbeatModel', 'default');

  const now = Date.now();
  const threadId = `overlord_${ now }`;

  const state: OverlordThreadState = {
    messages: [{
      role: 'user',
      content: prompt,
      metadata: { source: 'system' },
    }],
    metadata: {
      action: 'direct_answer',
      threadId,
      wsChannel: wsChannel,
      cycleComplete: false,
      waitingForUser: false,
      llmModel: await resolveModel(heartbeartModeheal),
      llmLocal: await resolveIsLocal(heartbeartModeheal),
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
      n8nLiveEventsEnabled: false,
      returnTo: null,
      primaryProject: '',
      projectDescription: '',
      projectGoals: [],
      projectState: 'continue',
    },
  };

  return state;
}

async function resolveModel(setting: string): Promise<string> {
  if (setting === 'default') return await getCurrentModel();

  const parts = setting.split(':');
  if (parts[0] === 'local' && parts.length === 2) return parts[1];
  if (parts[0] === 'remote' && parts.length >= 3) return parts.slice(2).join(':');

  return await getCurrentModel();
}

async function resolveIsLocal(setting: string): Promise<boolean> {
  if (setting === 'default') return (await getCurrentMode()) === 'local';
  return setting.startsWith('local:');
}

async function buildAgentState(wsChannel: string, threadId?: string): Promise<AgentGraphState> {
  const id = threadId ?? nextThreadId();

  const mode = await SullaSettingsModel.get('modelMode', 'local');
  const llmModel = mode === 'remote' ? await SullaSettingsModel.get('remoteModel', 'grok-4-1-fast-reasoning') : await SullaSettingsModel.get('sullaModel', 'tinyllama:latest');
  const llmLocal = mode === 'local';

  return {
    messages: [],
    metadata: {
      action: 'direct_answer',
      threadId: id,
      wsChannel: wsChannel,

      cycleComplete: false,
      waitingForUser: false,

      llmModel,
      llmLocal,
      options: { abort: undefined },
      currentNodeId: 'input_handler',
      consecutiveSameNode: 0,
      iterations: 0,
      revisionCount: 0,
      maxIterationsReached: false,
      memory: {
        knowledgeBaseContext: '',
        chatSummariesContext: ''
      },
      subGraph: {
        state: 'completed',
        name: 'hierarchical',
        prompt: '',
        response: ''
      },
      finalSummary: '',
      finalState: 'running',
      n8nLiveEventsEnabled: false,
      returnTo: null,

      agent: undefined,
      agentLoopCount: 0
    }
  };
}
