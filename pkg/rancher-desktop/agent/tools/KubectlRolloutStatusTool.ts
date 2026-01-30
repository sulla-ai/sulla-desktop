import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class KubectlRolloutStatusTool extends BaseTool {
  override readonly name = 'kubectl_rollout_status';

  override getPlanningInstructions(): string {
    return [
      '11) kubectl_rollout_status (Kubernetes via kubectl)',
      '   - Purpose: Check rollout status for a deployment.',
      '   - Args:',
      '     - namespace (string, required)',
      '     - deployment (string, required)',
      '     - timeoutSeconds (number, optional, default 60)',
      '   - Output: Rollout status output.',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "kubectl_rollout_status" and args.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const ns = String(context.args?.namespace || '');
    const deployment = String(context.args?.deployment || context.args?.name || '');
    const timeoutSeconds = Number(context.args?.timeoutSeconds ?? 60);

    if (!ns || !deployment) {
      return { toolName: this.name, success: false, error: 'Missing args: namespace, deployment' };
    }

    const timeout = Number.isFinite(timeoutSeconds) ? timeoutSeconds : 60;
    const res = await runCommand('kubectl', [
      'rollout',
      'status',
      `deployment/${deployment}`,
      '-n',
      ns,
      `--timeout=${timeout}s`,
    ], { timeoutMs: (timeout + 10) * 1000, maxOutputChars: 120_000 });

    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'kubectl rollout status failed' };
    }

    return { toolName: this.name, success: true, result: { namespace: ns, deployment, output: res.stdout } };
  }
}
