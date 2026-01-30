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

  abstract getPlanningInstructions(): string;

  abstract execute(state: ThreadState, context: ToolContext): Promise<ToolResult>;
}
