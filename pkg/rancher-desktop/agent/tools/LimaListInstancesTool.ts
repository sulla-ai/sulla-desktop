import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class LimaListInstancesTool extends BaseTool {
  override readonly name = 'lima_list_instances';
  override readonly category = 'lima';

  override getPlanningInstructions(): string {
    return [
      '19) lima_list_instances (Lima via limactl)',
      '   - Purpose: List Lima instances used by Rancher Desktop.',
      '   - Output: limactl list output (JSON when supported).',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "lima_list_instances".',
    ].join('\n');
  }

  override async execute(_state: ThreadState, _context: ToolContext): Promise<ToolResult> {
    // Try JSON first; if unsupported it will error and we retry without.
    let res = await runCommand('limactl', ['list', '--json'], { timeoutMs: 20_000, maxOutputChars: 160_000 });
    if (res.exitCode !== 0) {
      res = await runCommand('limactl', ['list'], { timeoutMs: 20_000, maxOutputChars: 160_000 });
    }

    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'limactl list failed' };
    }

    const out = res.stdout.trim();
    try {
      const parsed = JSON.parse(out);
      return { toolName: this.name, success: true, result: parsed };
    } catch {
      return { toolName: this.name, success: true, result: { output: out } };
    }
  }
}
