import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class LimaShellTool extends BaseTool {
  override readonly name = 'lima_shell';
  override readonly category = 'lima';

  override getPlanningInstructions(): string {
    return [
      '10) lima_shell (Lima via limactl)',
      '   - Purpose: Run a shell command inside a Lima VM instance.',
      '   - Args:',
      '     - name (string, required) instance name',
      '     - command (string, required) command to run inside the VM',
      '   - Output: stdout/stderr from the command.',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "lima_shell" and args.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const name = String(context.args?.name || context.args?.instance || '');
    const command = String(context.args?.command || '');

    if (!name || !command) {
      return { toolName: this.name, success: false, error: 'Missing args: name, command' };
    }

    const res = await runCommand('limactl', ['shell', name, '--', 'sh', '-lc', command], { timeoutMs: 30_000, maxOutputChars: 160_000 });
    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'limactl shell failed' };
    }

    return { toolName: this.name, success: true, result: { name, command, output: res.stdout, stderr: res.stderr || undefined } };
  }
}
