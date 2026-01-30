import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { getPlanService } from '../services/PlanService';

export class PlanGetTool extends BaseTool {
  override readonly name = 'plan_get';
  override readonly category = 'planning';

  override getPlanningInstructions(): string {
    return [
      '2) plan_get (Planning)',
      '   - Purpose: Load a plan (and todos/events) from Postgres.',
      '   - Args:',
      '     - planId (number, optional) explicit plan id',
      '     - threadId (string, optional) if provided, loads latest active plan for that thread',
      '   - Output: { plan, todos, events }',
    ].join('\n');
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    try {
      const planService = getPlanService();

      const planIdRaw = context.args?.planId;
      const threadIdRaw = context.args?.threadId;

      let planId: number | null = null;
      if (planIdRaw !== undefined && planIdRaw !== null && String(planIdRaw).trim().length > 0) {
        planId = Number(planIdRaw);
      } else if (threadIdRaw) {
        planId = await planService.getActivePlanIdForThread(String(threadIdRaw));
      } else {
        planId = await planService.getActivePlanIdForThread(state.threadId);
      }

      if (!planId || !Number.isFinite(planId)) {
        return { toolName: this.name, success: false, error: 'No active plan found' };
      }

      const plan = await planService.getPlan(planId);
      if (!plan) {
        return { toolName: this.name, success: false, error: `Plan not found: ${planId}` };
      }

      return { toolName: this.name, success: true, result: plan };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
