import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class HostFindFilesTool extends BaseTool {
  override readonly name = 'host_find_files';

  override getPlanningInstructions(): string {
    return [
      '31) host_find_files (Host filesystem)',
      '   - Purpose: Find files by name under a directory (uses `find`).',
      '   - Args:',
      '     - path (string, required) root directory',
      '     - pattern (string, required) glob-like name pattern (e.g. "*.log")',
      '     - maxDepth (number, optional)',
      '     - limit (number, optional, default 200)',
      '   - Output: matching paths (limited).',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const root = String(context.args?.path || '');
    const pattern = String(context.args?.pattern || '');
    const maxDepth = context.args?.maxDepth !== undefined ? Number(context.args.maxDepth) : undefined;
    const limit = Number(context.args?.limit ?? 200);

    if (!root || !pattern) {
      return { toolName: this.name, success: false, error: 'Missing args: path, pattern' };
    }

    const args: string[] = [root];
    if (maxDepth !== undefined && Number.isFinite(maxDepth)) {
      args.push('-maxdepth', String(maxDepth));
    }
    args.push('-name', pattern, '-print');

    const res = await runCommand('find', args, { timeoutMs: 20_000, maxOutputChars: 200_000 });
    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'find failed' };
    }

    const lines = res.stdout.split('\n').filter(Boolean);
    const n = Number.isFinite(limit) ? limit : 200;
    const matches = lines.slice(0, n);

    return { toolName: this.name, success: true, result: { root, pattern, count: lines.length, matches } };
  }
}
