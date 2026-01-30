import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { getPlanService } from '../services/PlanService';

export class PlanCreateTool extends BaseTool {
  override readonly name = 'plan_create';
  override readonly category = 'planning';

  override getPlanningInstructions(): string {
    return [
      '1) plan_create (Planning)',
      '   - Purpose: Create a new plan with todos and persist it to Postgres.',
      '   - Args:',
      '     - data (object, required) plan metadata/summary JSON',
      '     - todos (array, required) list of { title, description, orderIndex, categoryHints? }',
      '   - Output: { planId }',
    ].join('\n');
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    try {
      const dataRaw = context.args?.data;
      const todosRaw = context.args?.todos;

      if (!dataRaw || typeof dataRaw !== 'object') {
        return { toolName: this.name, success: false, error: 'Missing args.data (object)' };
      }

      if (!Array.isArray(todosRaw) || todosRaw.length === 0) {
        return { toolName: this.name, success: false, error: 'Missing args.todos (array)' };
      }

      const todos = todosRaw.map((t: any, idx: number) => ({
        title: String(t?.title || ''),
        description: String(t?.description || ''),
        orderIndex: Number.isFinite(Number(t?.orderIndex)) ? Number(t.orderIndex) : idx,
        categoryHints: Array.isArray(t?.categoryHints) ? t.categoryHints.map(String).filter(Boolean) : [],
      })).filter(t => t.title && t.description);

      if (todos.length === 0) {
        return { toolName: this.name, success: false, error: 'args.todos contained no valid todos (need title+description)' };
      }

      const planService = getPlanService();
      const res = await planService.createPlan({
        threadId: state.threadId,
        data: dataRaw as Record<string, unknown>,
        todos,
      });

      if (!res?.planId) {
        return { toolName: this.name, success: false, error: 'Failed to create plan' };
      }

      return { toolName: this.name, success: true, result: { planId: res.planId } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
