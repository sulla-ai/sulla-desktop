import { EventEmitter } from 'events';

import { getN8nBridgeService, N8nBridgeService } from './N8nBridgeService';

type JsonRecord = Record<string, unknown>;

export interface CanvasPosition {
  x: number;
  y: number;
  zoom: number;
}

export interface ExecutionSummary {
  id: string;
  workflowId?: string;
  status: string;
  mode?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface LiveExecution {
  executionId: string;
  workflowId?: string;
  status: 'running' | 'completed' | 'error' | 'stopped';
  logs: string[];
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
}

export interface N8nState {
  currentWorkflowId: string | null;
  currentWorkflow: JsonRecord | null;
  selectedNodes: string[];
  canvasPosition: CanvasPosition | null;
  executions: ExecutionSummary[];
  liveExecution: LiveExecution | null;
  activeUsers: string[];
  lastUpdated: Date;
}

export class N8nStateStore extends EventEmitter {
  private readonly bridge: N8nBridgeService;

  private state: N8nState = {
    currentWorkflowId: null,
    currentWorkflow: null,
    selectedNodes: [],
    canvasPosition: null,
    executions: [],
    liveExecution: null,
    activeUsers: [],
    lastUpdated: new Date(),
  };

  private readonly unsubs: Array<() => void> = [];
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private readonly pollingIntervalMs = 10_000;

  constructor(bridge: N8nBridgeService) {
    super();
    this.bridge = bridge;
    this.setupListeners();
    this.startPolling();
  }

  dispose(): void {
    for (const unsub of this.unsubs) {
      try {
        unsub();
      } catch {
        // no-op
      }
    }
    this.unsubs.length = 0;

    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private setupListeners(): void {
    this.unsubs.push(
      this.bridge.on('workflowUpdated', data => this.handleWorkflowChanged(data)),
      this.bridge.on('executionStarted', data => this.handleExecutionStarted(data)),
      this.bridge.on('nodeExecuted', data => this.handleNodeExecuted(data)),
      this.bridge.on('errorOccurred', data => this.handleErrorOccurred(data)),
      this.bridge.on('rawMessage', raw => this.handleRawMessage(raw)),
    );

    // Optional compatibility hooks if bridge emits push:* events later.
    const compatBridge = this.bridge as any;
    if (typeof compatBridge.on === 'function') {
      this.unsubs.push(
        compatBridge.on('push:workflow:changed', (data: unknown) => this.handleWorkflowChanged(data)),
        compatBridge.on('push:execution:started', (data: unknown) => this.handleExecutionStarted(data)),
        compatBridge.on('push:execution:log', (data: unknown) => this.handleExecutionLog(data)),
        compatBridge.on('push:node:selected', (data: unknown) => this.handleNodeSelected(data)),
      );
    }
  }

  private startPolling(): void {
    if (this.pollingTimer) {
      return;
    }

    this.pollingTimer = setInterval(() => {
      void this.poll().catch((error) => {
        this.emit('state:updated', this.getSnapshot());
        this.emit('errorOccurred', error instanceof Error ? error : new Error(String(error)));
      });
    }, this.pollingIntervalMs);
  }

  private async poll(): Promise<void> {
    await Promise.all([
      this.refreshCurrentWorkflow(),
      this.refreshExecutions(),
    ]);
  }

  private touchAndEmitState(): void {
    this.state.lastUpdated = new Date();
    this.emit('state:updated', this.getSnapshot());
  }

  private getSnapshot(): N8nState {
    return {
      ...this.state,
      selectedNodes: [...this.state.selectedNodes],
      executions: [...this.state.executions],
      activeUsers: [...this.state.activeUsers],
      liveExecution: this.state.liveExecution
        ? { ...this.state.liveExecution, logs: [...this.state.liveExecution.logs] }
        : null,
      canvasPosition: this.state.canvasPosition ? { ...this.state.canvasPosition } : null,
      currentWorkflow: this.state.currentWorkflow ? { ...this.state.currentWorkflow } : null,
      lastUpdated: new Date(this.state.lastUpdated),
    };
  }

  private handleWorkflowChanged(data: unknown): void {
    const payload = this.asRecord(data);
    const workflowId = this.pickString(payload, ['workflowId', 'id']);

    if (!workflowId) {
      return;
    }

    this.state.currentWorkflowId = workflowId;
    void this.refreshCurrentWorkflow();

    this.emit('workflow:changed', {
      workflowId,
      workflow: this.state.currentWorkflow,
    });
    this.touchAndEmitState();
  }

  private handleNodeSelected(data: unknown): void {
    const payload = this.asRecord(data);
    const selected = this.pickStringArray(payload, ['selectedNodes', 'nodeIds']);
    const singleNode = this.pickString(payload, ['nodeId', 'id']);

    const nextSelected = selected.length > 0
      ? selected
      : (singleNode ? [singleNode] : []);

    if (nextSelected.length === 0) {
      return;
    }

    this.state.selectedNodes = nextSelected;
    this.emit('node:selected', [...this.state.selectedNodes]);
    this.touchAndEmitState();
  }

  private handleExecutionStarted(data: unknown): void {
    const payload = this.asRecord(data);
    const executionId = this.pickString(payload, ['executionId', 'id']);
    if (!executionId) {
      return;
    }

    const workflowId = this.pickString(payload, ['workflowId']);

    if (workflowId) {
      this.state.currentWorkflowId = workflowId;
    }

    this.state.liveExecution = {
      executionId,
      workflowId: workflowId || undefined,
      status: 'running',
      logs: [],
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.pushExecution({
      id: executionId,
      workflowId: workflowId || undefined,
      status: 'running',
      startedAt: this.state.liveExecution.startedAt,
    });

    this.emit('execution:started', { ...this.state.liveExecution });
    this.touchAndEmitState();
  }

  private handleNodeExecuted(data: unknown): void {
    const payload = this.asRecord(data);
    const executionId = this.pickString(payload, ['executionId']);
    const nodeName = this.pickString(payload, ['nodeName', 'name']);

    if (!executionId && !nodeName) {
      return;
    }

    const logLine = nodeName
      ? `Node executed: ${nodeName}`
      : 'Node executed';

    this.appendLiveExecutionLog(executionId, logLine);
  }

  private handleExecutionLog(data: unknown): void {
    const payload = this.asRecord(data);
    const executionId = this.pickString(payload, ['executionId']);
    const logLine = this.pickString(payload, ['line', 'message', 'log']);

    if (!logLine) {
      return;
    }

    this.appendLiveExecutionLog(executionId, logLine);
  }

  private handleErrorOccurred(data: unknown): void {
    const payload = this.asRecord(data);
    const executionId = this.pickString(payload, ['executionId']);
    const message = this.pickString(payload, ['message', 'error']) || 'Unknown n8n error';

    if (executionId && this.state.liveExecution?.executionId === executionId) {
      this.state.liveExecution = {
        ...this.state.liveExecution,
        status: 'error',
        updatedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        logs: [...this.state.liveExecution.logs, `[error] ${message}`],
      };

      this.updateExecutionStatus(executionId, 'error', this.state.liveExecution.finishedAt);
      this.emit('execution:completed', { ...this.state.liveExecution });
    }

    this.emit('errorOccurred', new Error(message));
    this.touchAndEmitState();
  }

  private handleRawMessage(raw: unknown): void {
    const msg = this.asRecord(raw);
    const type = this.pickString(msg, ['type', 'event', 'name']).toLowerCase();

    if (!type) {
      return;
    }

    if (type.includes('node') && type.includes('select')) {
      this.handleNodeSelected(msg);
      return;
    }

    if (type.includes('execution') && (type.includes('log') || type.includes('progress'))) {
      this.handleExecutionLog(msg);
      return;
    }

    if (type.includes('execution') && (type.includes('finish') || type.includes('complete') || type.includes('success'))) {
      const executionId = this.pickString(msg, ['executionId', 'id']);
      this.completeLiveExecution(executionId, 'completed');
      return;
    }

    if (type.includes('execution') && (type.includes('error') || type.includes('fail'))) {
      const executionId = this.pickString(msg, ['executionId', 'id']);
      this.completeLiveExecution(executionId, 'error');
      return;
    }

    if (type.includes('canvas')) {
      const x = this.pickNumber(msg, ['x']);
      const y = this.pickNumber(msg, ['y']);
      const zoom = this.pickNumber(msg, ['zoom']);
      if (x !== null && y !== null && zoom !== null) {
        this.state.canvasPosition = { x, y, zoom };
        this.touchAndEmitState();
      }
      return;
    }

    if (type.includes('collaboration') || type.includes('presence') || type.includes('users')) {
      const users = this.pickStringArray(msg, ['activeUsers', 'users']);
      if (users.length > 0) {
        this.state.activeUsers = users;
        this.touchAndEmitState();
      }
    }
  }

  private appendLiveExecutionLog(executionId: string, line: string): void {
    if (!line) {
      return;
    }

    if (!this.state.liveExecution) {
      this.state.liveExecution = {
        executionId: executionId || 'unknown',
        status: 'running',
        logs: [],
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    if (executionId && this.state.liveExecution.executionId !== executionId) {
      this.state.liveExecution = {
        executionId,
        workflowId: this.state.currentWorkflowId || undefined,
        status: 'running',
        logs: [],
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    this.state.liveExecution.logs.push(line);
    this.state.liveExecution.updatedAt = new Date().toISOString();

    this.emit('execution:log', {
      executionId: this.state.liveExecution.executionId,
      line,
    });

    this.touchAndEmitState();
  }

  private completeLiveExecution(executionId: string, status: 'completed' | 'error' | 'stopped'): void {
    if (!this.state.liveExecution) {
      return;
    }

    if (executionId && this.state.liveExecution.executionId !== executionId) {
      return;
    }

    const finishedAt = new Date().toISOString();
    this.state.liveExecution = {
      ...this.state.liveExecution,
      status,
      updatedAt: finishedAt,
      finishedAt,
    };

    this.updateExecutionStatus(this.state.liveExecution.executionId, status, finishedAt);
    this.emit('execution:completed', { ...this.state.liveExecution });
    this.touchAndEmitState();
  }

  private pushExecution(summary: ExecutionSummary): void {
    this.state.executions = [summary, ...this.state.executions.filter(ex => ex.id !== summary.id)].slice(0, 20);
  }

  private updateExecutionStatus(executionId: string, status: string, finishedAt?: string): void {
    this.state.executions = this.state.executions.map(ex => {
      if (ex.id !== executionId) {
        return ex;
      }

      return {
        ...ex,
        status,
        finishedAt: finishedAt || ex.finishedAt,
      };
    });
  }

  private async refreshExecutions(): Promise<void> {
    const result = await this.bridge.request('/rest/executions?limit=20');
    const payload = this.asRecord(result);

    const list = this.pickArray(payload, ['data', 'executions']) || (Array.isArray(result) ? result : []);
    const mapped: ExecutionSummary[] = [];

    for (const item of list) {
      const rec = this.asRecord(item);
      const id = this.pickString(rec, ['id', 'executionId']);
      if (!id) {
        continue;
      }

      mapped.push({
        id,
        workflowId: this.pickString(rec, ['workflowId']) || undefined,
        status: this.pickString(rec, ['status']) || 'unknown',
        mode: this.pickString(rec, ['mode']) || undefined,
        startedAt: this.pickString(rec, ['startedAt', 'started_at']) || undefined,
        finishedAt: this.pickString(rec, ['finishedAt', 'stoppedAt', 'finished_at']) || undefined,
      });
    }

    this.state.executions = mapped.slice(0, 20);
    this.touchAndEmitState();
  }

  async refreshCurrentWorkflow(): Promise<void> {
    if (!this.state.currentWorkflowId) {
      return;
    }

    const workflow = await this.bridge.getWorkflow(this.state.currentWorkflowId);
    const wf = this.asRecord(workflow);

    this.state.currentWorkflow = Object.keys(wf).length > 0 ? wf : null;
    this.touchAndEmitState();
  }

  getCurrentWorkflow(): JsonRecord | null {
    return this.state.currentWorkflow ? { ...this.state.currentWorkflow } : null;
  }

  getCurrentWorkflowId(): string | null {
    return this.state.currentWorkflowId;
  }

  getSelectedNodes(): string[] {
    return [...this.state.selectedNodes];
  }

  getLastExecutions(limit = 10): ExecutionSummary[] {
    return this.state.executions.slice(0, limit).map(ex => ({ ...ex }));
  }

  getLiveExecution(): LiveExecution | null {
    return this.state.liveExecution ? { ...this.state.liveExecution, logs: [...this.state.liveExecution.logs] } : null;
  }

  getNodeById(nodeId: string): JsonRecord | null {
    const nodes = this.getWorkflowNodes();

    for (const node of nodes) {
      if (this.pickString(node, ['id']) === nodeId) {
        return node;
      }
    }

    return null;
  }

  getNodeByName(name: string): JsonRecord | null {
    const nodes = this.getWorkflowNodes();

    for (const node of nodes) {
      if (this.pickString(node, ['name']) === name) {
        return node;
      }
    }

    return null;
  }

  async waitForExecutionComplete(executionId: string, timeoutMs = 30_000): Promise<LiveExecution> {
    const immediate = this.state.liveExecution;
    if (immediate && immediate.executionId === executionId && immediate.status !== 'running') {
      return { ...immediate, logs: [...immediate.logs] };
    }

    return new Promise<LiveExecution>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for execution ${executionId} completion`));
      }, timeoutMs);

      const onCompleted = (execution: LiveExecution) => {
        if (execution.executionId !== executionId) {
          return;
        }
        cleanup();
        resolve({ ...execution, logs: [...execution.logs] });
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.off('execution:completed', onCompleted);
      };

      this.on('execution:completed', onCompleted);
    });
  }

  private getWorkflowNodes(): JsonRecord[] {
    const workflow = this.state.currentWorkflow;
    if (!workflow) {
      return [];
    }

    const nodes = workflow.nodes;
    if (!Array.isArray(nodes)) {
      return [];
    }

    return nodes
      .filter(node => node && typeof node === 'object')
      .map(node => node as JsonRecord);
  }

  private asRecord(value: unknown): JsonRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as JsonRecord;
  }

  private pickString(record: JsonRecord, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }

    return '';
  }

  private pickNumber(record: JsonRecord, keys: string[]): number | null {
    for (const key of keys) {
      const value = Number(record[key]);
      if (Number.isFinite(value)) {
        return value;
      }
    }

    return null;
  }

  private pickArray(record: JsonRecord, keys: string[]): unknown[] | null {
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value;
      }
    }

    return null;
  }

  private pickStringArray(record: JsonRecord, keys: string[]): string[] {
    for (const key of keys) {
      const value = record[key];
      if (!Array.isArray(value)) {
        continue;
      }

      const strings = value.filter(v => typeof v === 'string').map(v => String(v));
      if (strings.length > 0) {
        return strings;
      }
    }

    return [];
  }
}

let n8nStateStoreInstance: N8nStateStore | null = null;

export function getN8nStateStore(bridge: N8nBridgeService = getN8nBridgeService()): N8nStateStore {
  if (!n8nStateStoreInstance) {
    n8nStateStoreInstance = new N8nStateStore(bridge);
  }

  return n8nStateStoreInstance;
}
