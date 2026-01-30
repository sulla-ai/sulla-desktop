import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class KubectlLogsTool extends BaseTool {
  override readonly name = 'kubectl_logs';
  override readonly category = 'kubernetes_debug';

  override getPlanningInstructions(): string {
    return [
      '6) kubectl_logs (Kubernetes via kubectl)',
      '   - Purpose: Fetch logs from a pod/container to debug issues.',
      '   - Args:',
      '     - namespace (string, required)',
      '     - pod (string, required)',
      '     - container (string, optional)',
      '     - tail (number, optional, default 200)',
      '   - Output: Log text (truncated if large).',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "kubectl_logs" and args.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const ns = String(context.args?.namespace || '');
    const pod = String(context.args?.pod || context.args?.name || '');
    const container = context.args?.container ? String(context.args.container) : '';
    const tail = Number(context.args?.tail ?? 200);

    if (!ns || !pod) {
      return { toolName: this.name, success: false, error: 'Missing args: namespace, pod' };
    }

    const args = ['logs', pod, '-n', ns, '--tail', String(Number.isFinite(tail) ? tail : 200)];
    if (container) {
      args.push('-c', container);
    }

    const res = await runCommand('kubectl', args, { timeoutMs: 20_000, maxOutputChars: 120_000 });
    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'kubectl logs failed' };
    }

    return { toolName: this.name, success: true, result: { namespace: ns, pod, container: container || undefined, tail, output: res.stdout } };
  }
}
