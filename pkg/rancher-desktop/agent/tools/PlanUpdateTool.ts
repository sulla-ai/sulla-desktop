import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { getPlanService } from '../services/PlanService';

export class PlanUpdateTool extends BaseTool {
  override readonly name = 'plan_update';
  override readonly category = 'planning';

  override getPlanningInstructions(): string {
    return [
      '3) plan_update (Planning)',
      '   - Purpose: Record a plan update/revision as an event (does not mutate old history).',
      '   - Args:',
      '     - planId (number, required)',
      '     - type (string, optional, default "revised") event type',
      '     - data (object, optional) event payload',
      '   - Output: { ok: true }',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    try {
      const planIdRaw = context.args?.planId;
      if (planIdRaw === undefined || planIdRaw === null || String(planIdRaw).trim().length === 0) {
        return { toolName: this.name, success: false, error: 'Missing args.planId' };
      }

      const planId = Number(planIdRaw);
      if (!Number.isFinite(planId)) {
        return { toolName: this.name, success: false, error: 'Invalid args.planId (number)' };
      }

      const type = context.args?.type ? String(context.args.type) : 'revised';
      const data = (context.args?.data && typeof context.args.data === 'object')
        ? (context.args.data as Record<string, unknown>)
        : {};

      const ok = await getPlanService().addPlanEvent(planId, type, data);
      if (!ok) {
        return { toolName: this.name, success: false, error: 'Failed to add plan event' };
      }

      return { toolName: this.name, success: true, result: { ok: true } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
