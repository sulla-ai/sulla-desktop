import { BaseTool } from "../base";
import { z } from "zod";
import { AgentPlanTodo } from '../../database/models/AgentPlanTodo';
import { HierarchicalThreadState } from '../../nodes/Graph';

export class UpdatePlanTool extends BaseTool<HierarchicalThreadState> {
  name = "update_plan";
  description = "Mark milestones as complete, add notes, or update progress on the current plan.";
  schema = z.object({
    milestoneId: z.string(),
    status: z.enum(["done", "in_progress", "blocked", "pending"]).default("done"),
    note: z.string().optional(),
  });

  metadata = { category: "meta" };

  protected async _call(input: z.infer<this["schema"]>) {
    const plan = this.state!.metadata!.plan;
    if (!plan || !plan.milestones) return { success: false, error: "No active plan" };

    const milestone = plan.milestones.find((m) => m.model && m.model.id === input.milestoneId);
    if (milestone && milestone.model) {
      milestone.model.status = input.status;
      // Note: note property not implemented in AgentPlanTodoInterface yet
      // if (input.note) milestone.model.note = input.note;
      await milestone.model.save();
    }

    await this.emitProgressUpdate?.({
      type: "plan_updated",
      plan
    });

    return { success: true };
  }
}