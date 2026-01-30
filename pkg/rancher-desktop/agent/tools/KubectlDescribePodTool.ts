import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class KubectlDescribePodTool extends BaseTool {
  override readonly name = 'kubectl_describe_pod';
  override readonly category = 'kubernetes_debug';

  override getPlanningInstructions(): string {
    return [
      '5) kubectl_describe_pod (Kubernetes via kubectl)',
      '   - Purpose: Describe a pod for debugging (events, scheduling, container status).',
      '   - Args:',
      '     - namespace (string, required)',
      '     - pod (string, required)',
      '   - Output: Raw `kubectl describe` output (truncated if large).',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "kubectl_describe_pod" and args.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const ns = String(context.args?.namespace || '');
    const pod = String(context.args?.pod || context.args?.name || '');

    if (!ns || !pod) {
      return { toolName: this.name, success: false, error: 'Missing args: namespace, pod' };
    }

    const res = await runCommand('kubectl', ['describe', 'pod', pod, '-n', ns], { timeoutMs: 20_000, maxOutputChars: 120_000 });

    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'kubectl describe failed' };
    }

    return { toolName: this.name, success: true, result: { namespace: ns, pod, output: res.stdout } };
  }
}
