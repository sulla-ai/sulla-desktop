import { Graph, createOverlordGraph, OverlordThreadState, BaseThreadState, HierarchicalThreadState, createHierarchicalGraph, createSimpleGraph } from '../nodes/Graph';
import { SullaSettingsModel } from '../database/models/SullaSettingsModel';
import { getCurrentModel, getCurrentMode } from '../languagemodels';

const registry = new Map<string, {
  graph: Graph<any>;
  state: BaseThreadState;
}>();

export const GraphRegistry = {
  /**
   * Get existing graph for thread, or create new if not found.
   * Use this when resuming a known threadId.
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
    const graph = createHierarchicalGraph();

    const state = await buildHierarchicalState(wsChannel, threadId);

    registry.set(threadId, { graph, state });
    return { graph, state, threadId };
  },

  /**
   * Get or create — resumes if threadId exists, creates new if not.
   * Use in normal message flow.
   */
  getOrCreateSimpleGraph: async function(wsChannel: string, threadId: string): Promise<{
    graph: Graph<BaseThreadState>;
    state: BaseThreadState;
  }> {
    if (registry.has(threadId)) {
      return Promise.resolve(registry.get(threadId)!);
    }

    // No existing → create new under this threadId
    const graph = createSimpleGraph();

    const state = await buildSimpleState(wsChannel, threadId);

    registry.set(threadId, { graph, state });
    return { graph, state };
  },

  /**
   * Get or create — resumes if threadId exists, creates new if not.
   * Use in normal message flow.
   */
  getOrCreateOverlordGraph: async function(wsChannel: string, prompt?: string): Promise<{
    graph: Graph<OverlordThreadState>;
    state: BaseThreadState;
  }> {
    if (registry.has(wsChannel)) {
      return Promise.resolve(registry.get(wsChannel)!);
    }

    // No existing → create new under this threadId
    const graph = createOverlordGraph();

    const state = await buildOverlordState(wsChannel, prompt ?? '');

    registry.set(wsChannel, { graph, state });
    return { graph, state };
  },

  /**
   * Get or create — resumes if threadId exists, creates new if not.
   * Use in normal message flow.
   */
  getOrCreate: async function(wsChannel: string, threadId: string): Promise<{
    graph: Graph<any>;
    state: BaseThreadState;
  }> {
    if (registry.has(threadId)) {
      return Promise.resolve(registry.get(threadId)!);
    }

    // No existing → create new under this threadId
    const graph = createHierarchicalGraph();

    const state = await buildHierarchicalState(wsChannel, threadId);

    registry.set(threadId, { graph, state });
    return { graph, state };
  },

  delete(threadId: string): void {
    registry.delete(threadId);
  },

  clearAll(): void {
    registry.clear();
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

/**
 * 
 * @param wsChannel 
 * @param prompt 
 * @returns 
 */
async function buildOverlordState(wsChannel: string, prompt: string): Promise<OverlordThreadState> {
  // Build a minimal ThreadState and execute nodes directly (skip Sensory/ContextDetector/ConversationThread)

  let heartbeartModeheal = await SullaSettingsModel.get('heartbeatModel', 'default');

  const now = Date.now();
  const threadId = `overlord_${ now }`;

  const state: OverlordThreadState = {
    messages:        [{
      role:      'user',
      content:   prompt,
      metadata:  { source: 'system' },
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


/**
 * 
 * @param wsChannel 
 * @param threadId 
 * @returns 
 */
async function buildHierarchicalState(wsChannel: string, threadId?: string): Promise<HierarchicalThreadState> {
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
      currentNodeId: 'context_trimmer',
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
      returnTo: null,
      plan: {
        model: undefined,
        milestones: [],
        activeMilestoneIndex: 0,
        allMilestonesComplete: true
      },
      currentSteps: [],
      activeStepIndex: 0
    }
  };
}

/**
 * 
 * @param wsChannel 
 * @param threadId 
 * @returns 
 */
async function buildSimpleState(wsChannel: string, threadId?: string): Promise<BaseThreadState> {
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
      currentNodeId: 'context_trimmer',
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
      returnTo: null,
    }
  };
}
