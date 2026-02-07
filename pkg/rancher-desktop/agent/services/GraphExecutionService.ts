import type { SensoryInput, AgentResponse, ThreadState } from '../types';
import { BaseThreadState, HierarchicalThreadState, createHierarchicalGraph } from '../nodes/Graph';
import { emitAgentEvent } from './AgentEventBus';
import { AbortService } from './AbortService';
import { getCurrentModel, getCurrentMode } from '../languagemodels';

let threadCounter = 0;
let messageCounter = 0;

function nextThreadId(): string {
  return `thread_${Date.now()}_${++threadCounter}`;
}

function nextMessageId(): string {
  return `msg_${Date.now()}_${++messageCounter}`;
}

function buildInitialState(input: SensoryInput, threadId?: string): HierarchicalThreadState {
  const now = Date.now();
  const id = threadId ?? nextThreadId();

  return {
    messages: [{
      id:        nextMessageId(),
      role:      'user',
      content:   input.data,
      timestamp: now,
      metadata:  { ...input.metadata },
    } as any],
    metadata: {
      threadId: id,
      wsChannel: 'default',
      llmModel: getCurrentModel(),
      llmLocal: getCurrentMode() === 'local',
      options: { abort: undefined, confirm: undefined },
      currentNodeId: 'memory_recall',
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
      // Hierarchical-specific fields
      plan: undefined,
      currentSteps: [],
      activeStepIndex: 0
    }
  };
}

export async function runHierarchicalGraph(params: {
  input: SensoryInput;
  threadId?: string;
  wsChannel: string;
  onAgentResponse?: (resp: AgentResponse) => void;
  abort?: AbortService;
}): Promise<AgentResponse | null> {
  const state = buildInitialState(params.input, params.threadId);
  state.metadata.wsChannel = params.wsChannel;

  (state.metadata as any).__emitAgentEvent = (event: { type: 'progress' | 'complete' | 'error' | 'chunk'; data: any }) => {
    emitAgentEvent({
      type: event.type,
      threadId: state.metadata.threadId,
      data: event.data,
      timestamp: Date.now(),
    });
  };

  emitAgentEvent({ type: 'progress', threadId: state.metadata.threadId, data: { phase: 'start' }, timestamp: Date.now() });

  const graph = createHierarchicalGraph();

  try {
    if (params.abort) {
      (state.metadata as any).__abort = params.abort;
    }
    await graph.execute(state, undefined, { abort: params.abort });
  } catch (err) {
    emitAgentEvent({ type: 'error', threadId: state.metadata.threadId, data: { message: String(err) }, timestamp: Date.now() });
    return null;
  } finally {
    delete (state.metadata as any).__emitAgentEvent;
    delete (state.metadata as any).__abort;
  }

  const responseContent = typeof (state.metadata as any).response === 'string' ? (state.metadata as any).response.trim() : '';

  const response: AgentResponse = {
    id:        `resp_${Date.now()}`,
    threadId:  state.metadata.threadId,
    type:      'text',
    content:   responseContent,
    refined:   !!(state.metadata as any).criticDecision,
    metadata:  { ...state.metadata },
    timestamp: Date.now(),
  };

  emitAgentEvent({ type: 'complete', threadId: state.metadata.threadId, data: response, timestamp: Date.now() });

  params.onAgentResponse?.(response);

  return response;
}
