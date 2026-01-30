import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

type ContainerStatusSummary = {
  name: string;
  ready: boolean;
  restartCount: number;
  state?: string;
  reason?: string;
  message?: string;
  lastState?: string;
  lastReason?: string;
};

export class KubectlGetPodStatusTool extends BaseTool {
  override readonly name = 'kubectl_get_pod_status';

  override getPlanningInstructions(): string {
    return [
      '26) kubectl_get_pod_status (Kubernetes via kubectl)',
      '   - Purpose: Summarize pod and container status (ready/restarts/reasons).',
      '   - Args:',
      '     - namespace (string, required)',
      '     - pod (string, required)',
      '   - Output: Structured status summary.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const ns = String(context.args?.namespace || '');
    const pod = String(context.args?.pod || context.args?.name || '');

    if (!ns || !pod) {
      return { toolName: this.name, success: false, error: 'Missing args: namespace, pod' };
    }

    const res = await runCommand('kubectl', ['get', 'pod', pod, '-n', ns, '-o', 'json'], {
      timeoutMs: 20_000,
      maxOutputChars: 200_000,
    });

    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'kubectl get pod json failed' };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(res.stdout);
    } catch {
      return { toolName: this.name, success: false, error: 'Failed to parse kubectl JSON output' };
    }

    const phase = String(parsed?.status?.phase || '');
    const reason = parsed?.status?.reason ? String(parsed.status.reason) : undefined;
    const message = parsed?.status?.message ? String(parsed.status.message) : undefined;

    const statuses: any[] = Array.isArray(parsed?.status?.containerStatuses) ? parsed.status.containerStatuses : [];
    const initStatuses: any[] = Array.isArray(parsed?.status?.initContainerStatuses) ? parsed.status.initContainerStatuses : [];

    const summarize = (cs: any): ContainerStatusSummary => {
      const stateObj = cs?.state || {};
      const lastStateObj = cs?.lastState || {};

      const stateKey = Object.keys(stateObj)[0];
      const stateVal = stateKey ? stateObj[stateKey] : undefined;

      const lastKey = Object.keys(lastStateObj)[0];
      const lastVal = lastKey ? lastStateObj[lastKey] : undefined;

      return {
        name: String(cs?.name || ''),
        ready: Boolean(cs?.ready),
        restartCount: Number(cs?.restartCount ?? 0),
        state: stateKey,
        reason: stateVal?.reason ? String(stateVal.reason) : undefined,
        message: stateVal?.message ? String(stateVal.message) : undefined,
        lastState: lastKey,
        lastReason: lastVal?.reason ? String(lastVal.reason) : undefined,
      };
    };

    const containerSummaries = statuses.map(summarize);
    const initContainerSummaries = initStatuses.map(summarize);

    const result = {
      namespace: ns,
      pod,
      phase,
      reason,
      message,
      containers: containerSummaries,
      initContainers: initContainerSummaries,
      node: parsed?.spec?.nodeName ? String(parsed.spec.nodeName) : undefined,
    };

    return { toolName: this.name, success: true, result };
  }
}
