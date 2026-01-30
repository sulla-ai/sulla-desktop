import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import fs from 'fs';

export class HostTailFileTool extends BaseTool {
  override readonly name = 'host_tail_file';
  override readonly category = 'host_fs';

  override getPlanningInstructions(): string {
    return [
      '29) host_tail_file (Host filesystem)',
      '   - Purpose: Tail a host file (best effort).',
      '   - Args:',
      '     - path (string, required)',
      '     - lines (number, optional, default 200)',
      '   - Output: last N lines (best-effort).',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const p = String(context.args?.path || '');
    const lines = Number(context.args?.lines ?? 200);

    if (!p) {
      return { toolName: this.name, success: false, error: 'Missing args: path' };
    }

    try {
      const data = fs.readFileSync(p, 'utf-8');
      const parts = data.split('\n');
      const n = Number.isFinite(lines) ? lines : 200;
      const tail = parts.slice(-Math.max(1, n)).join('\n');
      return { toolName: this.name, success: true, result: { path: p, lines: n, content: tail } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
