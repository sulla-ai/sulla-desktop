import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { getPlanService } from '../services/PlanService';

export class PlanReviewTool extends BaseTool {
  override readonly name = 'plan_review';
  override readonly category = 'planning';

  override getPlanningInstructions(): string {
    return [
      '5) plan_review (Planning)',
      '   - Purpose: Persist a final review event for a plan.',
      '   - Args:',
      '     - planId (number, required)',
      '     - data (object, optional) review payload',
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

      const data = (context.args?.data && typeof context.args.data === 'object')
        ? (context.args.data as Record<string, unknown>)
        : {};

      const ok = await getPlanService().addPlanEvent(planId, 'final_review', data);
      if (!ok) {
        return { toolName: this.name, success: false, error: 'Failed to persist final_review' };
      }

      return { toolName: this.name, success: true, result: { ok: true } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
