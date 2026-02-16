import { BaseTool, ToolRegistration } from "../base";
import { HierarchicalThreadState } from '../../nodes/Graph';

/**
 * Update Plan Tool - Worker class for execution
 */
export class UpdatePlanWorker extends BaseTool<HierarchicalThreadState> {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  
  protected async _validatedCall(input: any) {
    const { milestoneId, status, note } = input;

    const plan = this.state!.metadata!.plan;
    if (!plan || !plan.milestones) return { success: false, error: "No active plan" };

    const milestone = plan.milestones.find((m) => m.model && m.model.id === milestoneId);
    if (milestone && milestone.model) {
      milestone.model.status = status;
      // Note: note property not implemented in AgentPlanTodoInterface yet
      // if (note) milestone.model.note = note;
      await milestone.model.save();
    }

    await this.emitProgressUpdate?.({
      type: "plan_updated",
      milestoneId: milestoneId,
      status: status,
      note: note,
    });

    return { success: true, milestoneId: milestoneId, status: status };
  }
}

// Export the complete tool registration with type enforcement
export const updatePlanRegistration: ToolRegistration = {
  name: "update_plan",
  description: "Mark milestones as complete, add notes, or update progress on the current plan.",
  category: "meta",
  schemaDef: {
    milestoneId: { type: 'string' as const },
    status: { type: 'enum' as const, enum: ["done", "in_progress", "blocked", "pending"], default: "done" },
    note: { type: 'string' as const, optional: true },
  },
  workerClass: UpdatePlanWorker,
};
