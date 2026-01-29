# Sulla Agent System

A modular, multi-agent reasoning system with conscious/subconscious processing loops.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INPUT                                      │
│                    (keyboard, microphone, camera, API)                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SENSORY INPUT                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  createTextInput(text) / createAudioInput(audio)                    │    │
│  │  - Captures mic/text/camera input                                   │    │
│  │  - Extracts text and metadata (source, speaker)                     │    │
│  │  - Outputs SensoryInput without blocking                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONTEXT DETECTOR                                     │
│                      (Prefrontal Analog - Fast)                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  detect(input) → ThreadContext                                      │    │
│  │  - Fast heuristic/LLM for topic classification                      │    │
│  │  - Matches to existing thread or creates new                        │    │
│  │  - Returns: threadId, isNew, summary, confidence                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CONVERSATION THREAD                                    │
│                    (Conscious Processing Loop)                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Per-thread state:                                                  │    │
│  │  - messages: full conversation history                              │    │
│  │  - shortTermMemory: recent 5 exchanges                              │    │
│  │  - metadata: thread-specific data                                   │    │
│  │  - subconsciousStatus: async task monitoring                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    GRAPH NODE PIPELINE                              │    │
│  │                                                                     │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │ NODE 1: MemoryNode                                            │  │    │
│  │  │ - Uses LLM to plan search query and collection                │  │    │
│  │  │ - Queries Chroma for relevant context                         │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  │                              │                                      │    │
│  │                              ▼                                      │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │ NODE 2: PlannerNode                                           │  │    │
│  │  │ - Analyzes query complexity                                   │  │    │
│  │  │ - Determines if tools are needed                              │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  │                              │                                      │    │
│  │                              ▼                                      │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │ NODE 3: ExecutorNode                                          │  │    │
│  │  │ - Builds contextual prompt with memory + history              │  │    │
│  │  │ - Calls Ollama LLM for response                               │  │    │
│  │  │ - Sets state.metadata.response                                │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  │                              │                                      │    │
│  │                              ▼                                      │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │ NODE 4: CriticNode                                            │  │    │
│  │  │ - Evaluates response quality                                  │  │    │
│  │  │ - Decides: approve / revise / reject                          │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RESPONSE HANDLER                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  formatText(response) → string                                      │    │
│  │  formatAudio(response) → TTS via Coqui (future)                     │    │
│  │  refine(response) → critique step for coherence                     │    │
│  │  route(response, inputSource) → modality routing                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER OUTPUT                                     │
│                    (text display or TTS audio)                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
agent/
├── index.ts              # Main exports
├── types.ts              # TypeScript interfaces
├── SensoryInput.ts       # Input capture (text/audio/camera)
├── ContextDetector.ts    # Fast thread selection/creation
├── ConversationThread.ts # Per-thread state + graph execution
├── Graph.ts              # LangGraph-style workflow orchestrator
├── ResponseHandler.ts    # Output formatting & critique
├── README.md             # This file
└── nodes/                # Graph nodes (LangGraph-style)
    ├── BaseNode.ts       # Abstract base class with Ollama LLM helpers
    ├── MemoryNode.ts     # Chroma queries for context
    ├── PlannerNode.ts    # Decides next steps
    ├── ExecutorNode.ts   # LLM calls + tool execution
    └── CriticNode.ts     # Approve/revise/reject decisions
```

## Core Classes

### SensoryInput
Captures input from various sources without blocking.

```typescript
const sensory = getSensory();

// Create text input from keyboard
const input = sensory.createTextInput("Hello, how are you?");

// Create audio input (after transcription)
const audioInput = sensory.createAudioInput(transcribedText, { speaker: "user1" });
```

### ContextDetector
Fast heuristic for thread selection - the "prefrontal cortex" analog.

```typescript
const detector = getContextDetector();

// Detect context and get/create thread
const context = await detector.detect(input);
// Returns: { threadId, isNew, summary, confidence }
```

### ConversationThread
Per-thread state management with conscious processing loop.

```typescript
const thread = getThread(threadId);

// Initialize (sets up graph with default nodes)
await thread.initialize();

// Process input through graph pipeline
const response = await thread.process(input);

// Access thread state
const state = thread.getState();
const memory = thread.getShortTermMemory();
```

### ResponseHandler
Output formatting with optional critique step.

```typescript
const handler = getResponseHandler();

// Format as text
const text = handler.formatText(response);

// Apply critique step (LLM refinement)
const refined = await handler.refine(response);

// Route based on input modality
const output = await handler.route(response, "microphone"); // → TTS
```

## Graph Node System (LangGraph-style)

The ConversationThread uses a LangGraph-style graph with nodes for processing.

### Node Interface

```typescript
interface GraphNode {
  id: string;
  name: string;
  execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }>;
  initialize?(): Promise<void>;
  destroy?(): Promise<void>;
}

type NodeResult = 'continue' | 'end' | 'loop' | string; // string = specific node name
```

### Default Graph Flow

```
Memory → Planner → Executor → Critic → (loop to Planner OR end)
```

| Node | Purpose |
|------|---------|
| **MemoryNode** | Queries Chroma for relevant past context |
| **PlannerNode** | Analyzes request, decides if tools needed |
| **ExecutorNode** | Builds prompt, calls LLM, executes tools |
| **CriticNode** | Reviews response: approve/revise/reject |

### Creating a Custom Node

```typescript
import { BaseNode } from './nodes/BaseNode';
import type { ThreadState, NodeResult } from './types';

export class MyCustomNode extends BaseNode {
  constructor() {
    super('my_node', 'My Custom Node');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    // Modify state
    state.metadata.myData = 'custom processing';
    
    // Return state and next node (or 'continue' to follow edges)
    return { state, next: 'continue' };
  }
}
```

### Adding Nodes to a Thread

```typescript
const thread = getThread(threadId);

// Add custom node
thread.addNode(new MyCustomNode());

// Add edge from existing node to custom node
thread.addEdge('planner', 'my_node');
thread.addEdge('my_node', 'executor');

// Or add conditional edge
thread.addConditionalEdge('my_node', (state) => {
  return state.metadata.needsReview ? 'critic' : 'executor';
});
```

### Graph Configuration

```typescript
import { Graph, MemoryNode, PlannerNode, ExecutorNode, CriticNode } from '@pkg/agent';

const graph = new Graph();

// Add nodes
graph.addNode(new MemoryNode());
graph.addNode(new PlannerNode());
graph.addNode(new ExecutorNode());
graph.addNode(new CriticNode());

// Fixed edges
graph.addEdge('memory_recall', 'planner');
graph.addEdge('planner', 'executor');
graph.addEdge('executor', 'critic');

// Conditional edge: Critic → Planner (revise) or END (approve)
graph.addConditionalEdge('critic', (state) => {
  return state.metadata.criticDecision === 'revise' ? 'planner' : 'end';
});

graph.setEntryPoint('memory_recall');
graph.setEndPoints('critic');
```

## Data Flow Example

```
1. User types: "What is 2+2?"

2. sensory.createTextInput("What is 2+2?")
   └─► SensoryInput { id, type: 'text', data: 'What is 2+2?', metadata: { source: 'keyboard' } }

3. contextDetector.detect(input)
   └─► ThreadContext { threadId: 'thread_123', isNew: true, summary: 'Math question' }

4. thread = getThread('thread_123')
   └─► New ConversationThread with empty state

5. thread.initialize()
   └─► Sets up graph with nodes: Memory → Planner → Executor → Critic

6. thread.process(input)
   │
   ├─► Records user message to state.messages
   │
   ├─► NODE 1: MemoryNode
   │   └─► Uses LLM to plan search, queries Chroma for context
   │
   ├─► NODE 2: PlannerNode
   │   └─► Analyzes complexity, determines if tools needed
   │
   ├─► NODE 3: ExecutorNode
   │   └─► Builds contextual prompt, calls Ollama LLM
   │       - Sets state.metadata.response = "2+2 equals 4."
   │
   ├─► NODE 4: CriticNode
   │   └─► Evaluates response quality: approve/revise/reject
   │
   └─► Records assistant message, returns AgentResponse

7. responseHandler.formatText(response)
   └─► Returns "2+2 equals 4."

8. UI displays: "2+2 equals 4."
```

## Usage in Agent.vue

```typescript
import {
  getSensory,
  getContextDetector,
  getThread,
  getResponseHandler,
} from '@pkg/agent';

const sensory = getSensory();
const contextDetector = getContextDetector();
const responseHandler = getResponseHandler();

const send = async () => {
  // 1. Create sensory input
  const input = sensory.createTextInput(query);

  // 2. Detect context and get/create thread
  const ctx = await contextDetector.detect(input);
  const thread = getThread(ctx.threadId);

  // 3. Initialize new threads (sets up graph nodes)
  if (ctx.isNew) {
    await thread.initialize();
  }

  // 4. Process through the graph pipeline
  const response = await thread.process(input);

  // 5. Handle response
  if (responseHandler.hasErrors(response)) {
    showError(responseHandler.getError(response));
  } else {
    showResponse(responseHandler.formatText(response));
  }
};
```

## Future: LangGraph Integration

The ConversationThread class is designed to eventually integrate LangGraph for:
- Stateful, interruptible, multi-step reasoning
- Cycles/loops/critique/human-in-the-loop
- Coordinating multiple specialized agents
- Checkpointing (save/resume thread state)

```typescript
// Future shape inside ConversationThread
class ConversationThread {
  private graph: CompiledStateGraph;
  
  constructor(threadId: string) {
    const workflow = new StateGraph(AgentState);
    workflow.addNode("memory_recall", this.memoryRecallNode);
    workflow.addNode("planner", this.plannerNode);
    workflow.addNode("executor", this.executorNode);
    workflow.addNode("critic", this.criticNode);
    // ... edges and conditions
    this.graph = workflow.compile({ checkpointer: MemorySaver() });
  }
}
```
