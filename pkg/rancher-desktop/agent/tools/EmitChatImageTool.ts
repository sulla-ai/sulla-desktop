import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { getWebSocketClientService } from '../services/WebSocketClientService';
import fs from 'fs';
import os from 'os';
import path from 'path';

function expandHome(inputPath: string): string {
  const p = String(inputPath || '').trim();
  if (!p) return p;

  const home = process.env.HOME || os.homedir();

  if (p === '~' || p === '$HOME') return home;
  if (p.startsWith('~/')) return path.join(home, p.slice(2));
  if (p.startsWith('$HOME/')) return path.join(home, p.slice(6));

  return p;
}

function guessContentType(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  };
  return map[ext] || null;
}

export class EmitChatImageTool extends BaseTool {
  override readonly name = 'emit_chat_image';

  override getPlanningInstructions(): string {
    return `["emit_chat_image", "/path/to/image.png"] - Display image in chat

Examples:
["emit_chat_image", "~/screenshots/lead-form.png", "--alt", "High-converting lead capture form"]
["emit_chat_image", "/tmp/chart.png", "--alt", "Conversion rate trend", "--role", "assistant"]
`.trim();
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const helpResult = await this.handleHelpRequest(context);
    if (helpResult) return helpResult;

    const args = this.getArgsArray(context); // after "emit_chat_image"

    if (!args.length) {
      return { toolName: this.name, success: false, error: 'Missing file path' };
    }

    // First arg = path
    const rawPath = args[0].trim();
    const params = this.argsToObject(args.slice(1));

    const alt = (params.alt as string) || '';
    const role = (params.role as string) || 'assistant';

    const filePath = expandHome(rawPath);
    if (!filePath) {
      return { toolName: this.name, success: false, error: 'Invalid/empty path' };
    }

    const contentType = guessContentType(filePath);
    if (!contentType) {
      return { toolName: this.name, success: false, error: `Unsupported extension: ${path.extname(filePath) || '(none)'}` };
    }

    let buf: Buffer;
    try {
      buf = fs.readFileSync(filePath);
    } catch (err: any) {
      return { toolName: this.name, success: false, error: `Read failed: ${err.message || String(err)}` };
    }

    const base64 = buf.toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    const connectionId = (state.metadata?.wsConnectionId as string) || 'chat-controller';

    const wsService = getWebSocketClientService();
    wsService.send(connectionId, {
      type: 'chat_image',
      data: { role, alt, contentType, dataUrl, path: filePath },
      timestamp: Date.now(),
    });

    return {
      toolName: this.name,
      success: true,
      result: { emitted: true, contentType, path: filePath, alt },
    };
  }
}