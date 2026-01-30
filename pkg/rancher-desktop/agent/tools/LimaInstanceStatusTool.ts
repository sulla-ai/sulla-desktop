import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class LimaInstanceStatusTool extends BaseTool {
  override readonly name = 'lima_instance_status';

  override getPlanningInstructions(): string {
    return [
      '18) lima_instance_status (Lima via limactl)',
      '   - Purpose: Show detailed info for a Lima instance.',
      '   - Args:',
      '     - name (string, required) instance name',
      '   - Output: limactl info output (JSON when supported).',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "lima_instance_status" and args.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const name = String(context.args?.name || context.args?.instance || '');
    if (!name) {
      return { toolName: this.name, success: false, error: 'Missing args: name' };
    }

    let res = await runCommand('limactl', ['info', name, '--json'], { timeoutMs: 20_000, maxOutputChars: 160_000 });
    if (res.exitCode !== 0) {
      res = await runCommand('limactl', ['info', name], { timeoutMs: 20_000, maxOutputChars: 160_000 });
    }

    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'limactl info failed' };
    }

    const out = res.stdout.trim();
    try {
      const parsed = JSON.parse(out);
      return { toolName: this.name, success: true, result: parsed };
    } catch {
      return { toolName: this.name, success: true, result: { name, output: out } };
    }
  }
}
