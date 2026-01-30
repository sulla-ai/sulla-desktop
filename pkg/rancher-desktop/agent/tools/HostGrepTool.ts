import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class HostGrepTool extends BaseTool {
  override readonly name = 'host_grep';
  override readonly category = 'host_fs';

  override getPlanningInstructions(): string {
    return [
      '32) host_grep (Host filesystem)',
      '   - Purpose: Search text in files on the host.',
      '   - Args:',
      '     - path (string, required) root directory',
      '     - query (string, required) search string/regex',
      '     - limit (number, optional, default 200) max lines',
      '   - Output: matching lines (limited).',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const root = String(context.args?.path || '');
    const query = String(context.args?.query || '');
    const limit = Number(context.args?.limit ?? 200);

    if (!root || !query) {
      return { toolName: this.name, success: false, error: 'Missing args: path, query' };
    }

    // Try rg first.
    let res = await runCommand('rg', ['-n', '--no-heading', '--color', 'never', query, root], { timeoutMs: 20_000, maxOutputChars: 200_000 });
    if (res.exitCode !== 0 && !res.stdout && !res.stderr) {
      // If rg not found or other failure with no output, try grep.
      res = await runCommand('grep', ['-RIn', query, root], { timeoutMs: 20_000, maxOutputChars: 200_000 });
    }

    if (res.exitCode !== 0 && !res.stdout) {
      // grep/rg uses exitCode=1 for no matches; treat as success.
      if (res.exitCode === 1) {
        return { toolName: this.name, success: true, result: { root, query, matches: [] } };
      }
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'search failed' };
    }

    const lines = res.stdout.split('\n').filter(Boolean);
    const n = Number.isFinite(limit) ? limit : 200;
    const matches = lines.slice(0, n);

    return { toolName: this.name, success: true, result: { root, query, count: lines.length, matches } };
  }
}
