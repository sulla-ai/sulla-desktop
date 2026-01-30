import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { getPlanService, type TodoStatus } from '../services/PlanService';

export class PlanMarkDoneTool extends BaseTool {
  override readonly name = 'plan_mark_done';
  override readonly category = 'planning';

  override getPlanningInstructions(): string {
    return [
      '4) plan_mark_done (Planning)',
      '   - Purpose: Update a todo status and persist an event.',
      '   - Args:',
      '     - todoId (number, required)',
      '     - status (string, optional, default "done") one of pending|in_progress|done|blocked',
      '     - eventType (string, optional, default "todo_status")',
      '     - eventData (object, optional)',
      '   - Output: { ok: true }',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    try {
      const todoIdRaw = context.args?.todoId;
      if (todoIdRaw === undefined || todoIdRaw === null || String(todoIdRaw).trim().length === 0) {
        return { toolName: this.name, success: false, error: 'Missing args.todoId' };
      }

      const todoId = Number(todoIdRaw);
      if (!Number.isFinite(todoId)) {
        return { toolName: this.name, success: false, error: 'Invalid args.todoId (number)' };
      }

      const rawStatus = context.args?.status ? String(context.args.status) : 'done';
      const status: TodoStatus = (rawStatus === 'pending' || rawStatus === 'in_progress' || rawStatus === 'blocked')
        ? rawStatus
        : 'done';

      const eventType = context.args?.eventType ? String(context.args.eventType) : 'todo_status';
      const eventData = (context.args?.eventData && typeof context.args.eventData === 'object')
        ? (context.args.eventData as Record<string, unknown>)
        : {};

      const ok = await getPlanService().updateTodoStatus({
        todoId,
        status,
        eventType,
        eventData,
      });

      if (!ok) {
        return { toolName: this.name, success: false, error: 'Failed to update todo status' };
      }

      return { toolName: this.name, success: true, result: { ok: true } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
