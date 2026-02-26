import { EventEmitter } from 'events';

import { N8nBridgeService } from './N8nBridgeService';
import { N8nStateStore } from './N8nStateStore';

export interface N8nLogEntry {
  timestamp: string;
  type: 'websocket' | 'api' | 'execution' | 'error' | 'state' | 'info';
  action?: string;
  workflowId?: string;
  executionId?: string;
  nodeName?: string;
  message?: string;
  data?: unknown;
  durationMs?: number;
}

export class N8nEventLog extends EventEmitter {
  private logs: N8nLogEntry[] = [];
  private readonly maxEntries = 8000;

  constructor(
    private bridge: N8nBridgeService,
    private stateStore?: N8nStateStore,
  ) {
    super();
    this.setupListeners();
    this.instrumentBridgeRequest();
  }

  private setupListeners(): void {
    this.bridge.on('rawMessage', (payload) => this.add({
      type: 'websocket',
      action: 'rawMessage',
      data: payload,
    }));

    this.bridge.on('workflowUpdated', (e) => this.add({
      type: 'websocket',
      action: 'workflowUpdated',
      workflowId: e.workflowId,
      data: e.workflow,
    }));

    this.bridge.on('executionStarted', (e) => this.add({
      type: 'execution',
      action: 'started',
      executionId: e.executionId,
      workflowId: e.workflowId,
      data: e.raw,
    }));

    this.bridge.on('nodeExecuted', (e) => this.add({
      type: 'execution',
      action: 'nodeExecuted',
      executionId: e.executionId,
      workflowId: e.workflowId,
      nodeName: e.nodeName,
      data: e.raw,
    }));

    this.bridge.on('errorOccurred', (e) => this.add({
      type: 'error',
      action: 'bridgeError',
      message: e.message,
      data: e.raw,
    }));

    if (this.stateStore) {
      this.stateStore.on('state:updated', (state) => {
        this.add({
          type: 'state',
          action: 'stateUpdated',
          workflowId: state?.currentWorkflowId || undefined,
        });
      });

      this.stateStore.on('execution:completed', (execution) => {
        this.add({
          type: 'execution',
          action: 'completed',
          executionId: execution?.executionId,
          workflowId: execution?.workflowId,
          data: execution,
        });
      });

      this.stateStore.on('execution:log', (log) => {
        this.add({
          type: 'execution',
          action: 'log',
          executionId: log?.executionId,
          message: log?.line,
          data: log,
        });
      });
    }
  }

  private instrumentBridgeRequest(): void {
    const bridgeAny = this.bridge as N8nBridgeService & {
      request: (...args: any[]) => Promise<unknown>;
      __n8nEventLogInstrumented?: boolean;
    };

    if (bridgeAny.__n8nEventLogInstrumented) {
      return;
    }

    const originalRequest = bridgeAny.request.bind(this.bridge);

    bridgeAny.request = async(endpoint: string, options: {
      method?: string;
      body?: string;
      headers?: Record<string, string>;
      includeAuthHeader?: boolean;
    } = {}) => {
      const startedAt = Date.now();
      const method = options.method || 'GET';
      const workflowId = this.extractWorkflowId(endpoint, options.body);

      this.add({
        type: 'api',
        action: `${method.toUpperCase()} ${endpoint}`,
        workflowId,
        data: {
          endpoint,
          method,
        },
      });

      try {
        const result = await originalRequest(endpoint, options);
        this.add({
          type: 'api',
          action: `${method.toUpperCase()} ${endpoint}:success`,
          workflowId,
          durationMs: Date.now() - startedAt,
        });

        return result;
      } catch (error) {
        this.add({
          type: 'error',
          action: `${method.toUpperCase()} ${endpoint}:error`,
          workflowId,
          message: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
          data: error,
        });
        throw error;
      }
    };

    bridgeAny.__n8nEventLogInstrumented = true;
  }

  add(entry: Omit<N8nLogEntry, 'timestamp'>): void {
    const logEntry: N8nLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    this.logs.unshift(logEntry);
    if (this.logs.length > this.maxEntries) {
      this.logs.pop();
    }

    this.emit('log:added', logEntry);
  }

  getLast(seconds: number): N8nLogEntry[] {
    const cutoff = Date.now() - seconds * 1000;
    return this.logs.filter(log => new Date(log.timestamp).getTime() > cutoff);
  }

  getByWorkflow(workflowId: string, limit = 50): N8nLogEntry[] {
    return this.logs
      .filter(log => log.workflowId === workflowId)
      .slice(0, limit);
  }

  getByType(type: string, since?: Date): N8nLogEntry[] {
    return this.logs.filter(log => {
      if (log.type !== type) {
        return false;
      }
      if (since && new Date(log.timestamp) < since) {
        return false;
      }
      return true;
    });
  }

  search(keyword: string, limit = 50): N8nLogEntry[] {
    const lower = keyword.toLowerCase();
    return this.logs
      .filter(log => {
        const messageHit = (log.message || '').toLowerCase().includes(lower);
        const dataHit = JSON.stringify(log.data ?? '').toLowerCase().includes(lower);
        const actionHit = (log.action || '').toLowerCase().includes(lower);

        return messageHit || dataHit || actionHit;
      })
      .slice(0, limit);
  }

  getRecentErrors(limit = 20): N8nLogEntry[] {
    return this.logs
      .filter(log => log.type === 'error')
      .slice(0, limit);
  }

  getTotalCount(): number {
    return this.logs.length;
  }

  clear(): void {
    this.logs = [];
  }

  private extractWorkflowId(endpoint: string, body?: string): string | undefined {
    const match = endpoint.match(/\/workflows\/([^/?]+)/i);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }

    if (!body) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      const workflowId = parsed.workflowId;

      if (typeof workflowId === 'string' && workflowId.trim()) {
        return workflowId;
      }
    } catch {
      // ignore parse failures
    }

    return undefined;
  }
}

let eventLogInstance: N8nEventLog | null = null;

export function getN8nEventLog(bridge: N8nBridgeService, stateStore?: N8nStateStore): N8nEventLog {
  if (!eventLogInstance) {
    eventLogInstance = new N8nEventLog(bridge, stateStore);
  }

  return eventLogInstance;
}
