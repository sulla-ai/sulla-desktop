import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import fs from 'fs';

export class HostReadFileTool extends BaseTool {
  override readonly name = 'host_read_file';
  override readonly category = 'host_fs';

  override getPlanningInstructions(): string {
    return [
      '28) host_read_file (Host filesystem)',
      '   - Purpose: Read a file from the host filesystem.',
      '   - Args:',
      '     - path (string, required)',
      '     - offset (number, optional, default 0) byte offset',
      '     - limit (number, optional, default 80000) max bytes',
      '   - Output: File content (truncated).',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const p = String(context.args?.path || '');
    const offset = Number(context.args?.offset ?? 0);
    const limit = Number(context.args?.limit ?? 80_000);

    if (!p) {
      return { toolName: this.name, success: false, error: 'Missing args: path' };
    }

    try {
      const fd = fs.openSync(p, 'r');
      try {
        const buf = Buffer.alloc(Number.isFinite(limit) ? limit : 80_000);
        const bytesRead = fs.readSync(fd, buf, 0, buf.length, Number.isFinite(offset) ? offset : 0);
        const content = buf.slice(0, bytesRead).toString('utf-8');
        return { toolName: this.name, success: true, result: { path: p, offset, bytesRead, content } };
      } finally {
        fs.closeSync(fd);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
