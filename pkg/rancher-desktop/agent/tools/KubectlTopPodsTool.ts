import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class KubectlTopPodsTool extends BaseTool {
  override readonly name = 'kubectl_top_pods';
  override readonly category = 'kubernetes_debug';

  override getPlanningInstructions(): string {
    return [
      '9) kubectl_top_pods (Kubernetes via kubectl)',
      '   - Purpose: View pod CPU/memory usage for debugging and capacity planning.',
      '   - Args:',
      '     - namespace (string, optional) if omitted uses all namespaces',
      '   - Output: `kubectl top pods` output.',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "kubectl_top_pods".',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const ns = context.args?.namespace ? String(context.args.namespace) : '';
    const args = ns ? ['top', 'pods', '-n', ns] : ['top', 'pods', '-A'];

    const res = await runCommand('kubectl', args, { timeoutMs: 20_000, maxOutputChars: 120_000 });

    if (res.exitCode !== 0) {
      return {
        toolName: this.name,
        success: false,
        error: res.stderr || res.stdout || 'kubectl top pods failed (metrics-server may be missing)',
      };
    }

    return { toolName: this.name, success: true, result: { namespace: ns || 'all', output: res.stdout } };
  }
}
