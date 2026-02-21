import { BaseTool, ToolRegistration, ToolResponse } from "../base";

type MilestoneStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

interface FrontendMilestone {
  id: string;
  title: string;
  description: string;
  successcriteria?: string;
  dependson?: string[];
  orderIndex: number;
  status: MilestoneStatus;
  note?: string;
}

interface FrontendPlan {
  id: string;
  milestones: FrontendMilestone[];
}

/**
 * Update Plan Tool - Worker class for execution
 */
export class UpdatePlanWorker extends BaseTool<any> {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { milestoneId, status, note } = input;

    const plan = this.state!.metadata!.plan as FrontendPlan | undefined;
    if (!plan || !plan.milestones) {
      return {
        successBoolean: false,
        responseString: "No active plan"
      };
    }

    const milestone = plan.milestones.find((m: FrontendMilestone) => m.id === milestoneId);
    if (!milestone) {
      return {
        successBoolean: false,
        responseString: `Milestone ${milestoneId} not found in active plan`
      };
    }

    milestone.status = status as MilestoneStatus;
    if (typeof note === 'string' && note.trim()) {
      milestone.note = note;
    }

    if (this.state) {
      (this.state as any).metadata = (this.state as any).metadata || {};
      (this.state as any).metadata.plan = plan;
      (this.state as any).metadata.planTodos = plan.milestones;
    }

    await this.emitProgressUpdate?.({
      type: "plan_updated",
      planId: plan.id,
      milestoneId,
      status: milestone.status,
      note: milestone.note,
      milestone,
    });

    return {
      successBoolean: true,
      responseString: `Milestone ${milestoneId} updated to ${milestone.status}`
    };
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
