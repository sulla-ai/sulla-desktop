// Agent System Types
// Flow: SensoryInput → ContextDetector → ConversationThread → Response

// ============================================================================
// SENSORY INPUT TYPES
// ============================================================================

export interface SensoryInput {
  id: string;
  type: 'text' | 'audio' | 'image';
  data: string;
  metadata: SensoryMetadata;
  timestamp: number;
}

export interface SensoryMetadata {
  source: 'keyboard' | 'microphone' | 'camera' | 'api';
  speaker?: string;
  language?: string;
  [key: string]: unknown;
}

// ============================================================================
// CONTEXT DETECTOR TYPES
// ============================================================================

export interface ThreadContext {
  threadId: string;
  isNew: boolean;
  summary: string;
  topic?: string;
  confidence: number;
}

// ============================================================================
// CONVERSATION THREAD TYPES
// ============================================================================

export interface ThreadState {
  threadId: string;
  messages: Message[];
  shortTermMemory: Message[]; // Recent 5 exchanges
  metadata: Record<string, unknown>;
  subconsciousStatus: SubconsciousStatus;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface SubconsciousStatus {
  deepMemory: TaskStatus;
  toolExecutor: TaskStatus;
  integrator: TaskStatus;
}

export interface TaskStatus {
  state: 'idle' | 'running' | 'completed' | 'failed';
  progress?: number;
  result?: unknown;
  error?: string;
}

// ============================================================================
// SUBCONSCIOUS TYPES (Async Workers)
// ============================================================================

export interface SubconsciousTask {
  id: string;
  type: 'deep_memory' | 'tool_execution' | 'integration';
  input: unknown;
  status: TaskStatus;
}

export interface DeepMemoryQuery {
  query: string;
  threadId: string;
  limit?: number;
}

export interface DeepMemoryResult {
  documents: string[];
  scores: number[];
  metadata: Record<string, unknown>[];
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolName: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface AgentResponse {
  id: string;
  threadId: string;
  type: 'text' | 'audio';
  content: string;
  refined: boolean; // Whether critique step was applied
  metadata: Record<string, unknown>;
  timestamp: number;
}

// ============================================================================
// GRAPH NODE TYPES (LangGraph-style)
// ============================================================================

export type NodeResult = 'continue' | 'end' | 'loop' | string; // string = next node name

export interface GraphNode {
  id: string;
  name: string;
  execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }>;
  initialize?(): Promise<void>;
  destroy?(): Promise<void>;
}

export interface GraphEdge {
  from: string;
  to: string | ((state: ThreadState) => string); // Static or conditional
}

export interface GraphConfig {
  nodes: GraphNode[];
  edges: GraphEdge[];
  entryPoint: string;
  endPoints: string[];
}

// ============================================================================
// PLUGIN TYPES (Legacy - for backward compatibility)
// ============================================================================

export interface PluginConfig {
  id: string;
  name: string;
  order: number;
  enabled: boolean;
  settings: Record<string, unknown>;
}

export interface Plugin {
  config: PluginConfig;
  initialize?(): Promise<void>;
  beforeProcess?(state: ThreadState): Promise<ThreadState>;
  process?(state: ThreadState): Promise<ThreadState>;
  afterProcess?(state: ThreadState): Promise<ThreadState>;
  destroy?(): Promise<void>;
}

// ============================================================================
// EVENT TYPES (for streaming/progress updates)
// ============================================================================

export interface AgentEvent {
  type: 'progress' | 'chunk' | 'complete' | 'error';
  threadId: string;
  data: unknown;
  timestamp: number;
}

export type AgentEventHandler = (event: AgentEvent) => void;
