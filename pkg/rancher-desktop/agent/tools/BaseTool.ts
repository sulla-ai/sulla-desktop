import type { ThreadState, ToolResult } from '../types';

export interface ToolContext {
  threadId: string;
  plannedAction: string;
  memorySearchQueries?: string[];
  args?: Record<string, unknown>;
}

export abstract class BaseTool {
  abstract readonly name: string;
  readonly category: string = 'uncategorized';
  readonly aliases: string[] = [];

  /** Detailed instructions for the executor on how to use this tool (args, output format, etc.) */
  abstract getPlanningInstructions(): string;

  /** Brief description for the tactical planner to decide if this tool is needed for a milestone */
  getTacticalInstructions(): string {
    // Return the first two lines of planning instructions
    const planning = this.getPlanningInstructions();
    const lines = planning.split('\n').filter(l => l.trim());
    return lines.slice(0, 2).join('\n') || this.name;
  }

  abstract execute(state: ThreadState, context: ToolContext): Promise<ToolResult>;
}
