import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class KubectlGetEventsTool extends BaseTool {
  override readonly name = 'kubectl_get_events';
  override readonly category = 'kubernetes_debug';

  override getPlanningInstructions(): string {
    return [
      '7) kubectl_get_events (Kubernetes via kubectl)',
      '   - Purpose: Fetch recent Kubernetes events to diagnose scheduling and runtime issues.',
      '   - Args:',
      '     - limit (number, optional, default 100)',
      '   - Output: Recent events table text.',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "kubectl_get_events".',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const limit = Number(context.args?.limit ?? 100);
    const res = await runCommand('kubectl', ['get', 'events', '-A', '--sort-by=.lastTimestamp', '--no-headers'], {
      timeoutMs: 20_000,
      maxOutputChars: 120_000,
    });

    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'kubectl get events failed' };
    }

    const lines = res.stdout.split('\n').filter(Boolean);
    const sliced = lines.slice(-Math.max(1, Number.isFinite(limit) ? limit : 100));

    return {
      toolName: this.name,
      success: true,
      result: { limit: Number.isFinite(limit) ? limit : 100, output: sliced.join('\n') },
    };
  }
}
