import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class KubectlRolloutRestartTool extends BaseTool {
  override readonly name = 'kubectl_rollout_restart';
  override readonly category = 'kubernetes_write';

  override getPlanningInstructions(): string {
    return [
      '13) kubectl_rollout_restart (Kubernetes via kubectl)',
      '   - Purpose: Restart a deployment rollout (mutates cluster state).',
      '   - Args:',
      '     - namespace (string, required)',
      '     - deployment (string, required)',
      '   - Output: Restart command output.',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "kubectl_rollout_restart" and args.',
      '     - Use this tool cautiously. It could break your cluster.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const ns = String(context.args?.namespace || '');
    const deployment = String(context.args?.deployment || context.args?.name || '');

    if (!ns || !deployment) {
      return { toolName: this.name, success: false, error: 'Missing args: namespace, deployment' };
    }

    const res = await runCommand('kubectl', ['rollout', 'restart', `deployment/${deployment}`, '-n', ns], {
      timeoutMs: 20_000,
      maxOutputChars: 120_000,
    });

    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'kubectl rollout restart failed' };
    }

    return { toolName: this.name, success: true, result: { namespace: ns, deployment, output: res.stdout } };
  }
}
