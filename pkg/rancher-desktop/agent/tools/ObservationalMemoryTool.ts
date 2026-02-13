// ObservationalMemoryTool.ts - Tool for managing observational memory entries

import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { SullaSettingsModel } from '../database/models/SullaSettingsModel';

export class ObservationalMemoryTool extends BaseTool {
  name = 'observational_memory';

  getPlanningInstructions(): string {
    return `Add entries to observational memory for long-term retention and context awareness.

Examples:
["observational_memory", [["🔴", "2026-02-12 20:00", "jonathon prefers dark mode"]]]
["observational_memory", [["🟡", "2026-02-12 20:05", "The x project app we built uses React framework"], ["⚪", "2026-02-12 20:10", "jonathon prefers ai agent news with his coffee in the morning"]]]

Priority levels:
🔴 Critical: user preferences, goals, commitments, breakthroughs
🟡 Useful: progress updates, decisions, patterns observed
⚪ Minor: transient observations, low-signal information

Use this tool to store important information that should persist across conversations and influence future behavior.`;
  }

  private tinyId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 4; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const args = this.getArgsArray(context);
    if (args.length < 1) {
      return { toolName: this.name, success: false, error: 'Missing memory array' };
    }

    const memoryArray = args[0];
    if (!Array.isArray(memoryArray)) {
      return { toolName: this.name, success: false, error: 'Memory array must be an array' };
    }

    try {
      // Convert array of arrays to objects if needed
      const normalizedMemory = memoryArray.map(item => {
        if (Array.isArray(item) && item.length >= 3) {
          return {
            priority: item[0],
            timestamp: item[1],
            content: item[2]
          };
        } else if (typeof item === 'object' && item.priority && item.timestamp && item.content) {
          return item; // already in object format
        } else {
          // silent error, these memories aren't important enough to collapse the software
        }
      }).filter(item => item !== null && item !== undefined);

      // Assign tiny ID to each memory item
      const memoryWithIds = normalizedMemory.map(item => ({
        ...item,
        id: this.tinyId(),
        threadId: state.metadata.threadId,
      }));

      // Ensure it's valid JSON by stringify and parse
      const jsonString = JSON.stringify(memoryWithIds);
      JSON.parse(jsonString);

      // Store the array in settings
      await SullaSettingsModel.set('observationalMemory', memoryWithIds, 'json');

      return { toolName: this.name, success: true, result: `Stored ${memoryWithIds.length} memory entries` };
    } catch (error: any) {
      return { toolName: this.name, success: false, error: error.message };
    }
  }
}
