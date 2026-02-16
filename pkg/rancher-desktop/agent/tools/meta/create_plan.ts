import { BaseTool, ToolRegistration } from "../base";
import { AgentPlan } from '../../database/models/AgentPlan';
import { AgentPlanTodo } from '../../database/models/AgentPlanTodo';

/**
 * Create Plan Tool - Worker class for execution
 */
export class CreatePlanWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    console.log('[CreatePlanTool] updatePlan started');

    const plan = await AgentPlan.create({
      thread_id: (this.state as any).thread_id,
      goal: input.goal,
      goaldescription: input.goaldescription,
      requirestools: input.requirestools,
      complexity: input.estimatedcomplexity,
      status: 'active',
      wschannel: (this.state as any).wschannel,
    });

    // Create todo items for each milestone
    for (const milestone of input.milestones) {
      const todo = await AgentPlanTodo.create({
        planId: plan.id,
        milestoneId: milestone.id,
        title: milestone.title,
        description: milestone.description,
        successCriteria: milestone.successcriteria,
        status: 'pending',
        dependsOn: milestone.dependson,
      });
    }

    // Load all plans for the thread
    const allPlans = await AgentPlan.where({ thread_id: (this.state as any).thread_id });

    // Load all todos for all plans and construct milestones array
    const milestones = [];
    for (const p of allPlans) {
      const todos = await AgentPlanTodo.findForPlan(p.id);
      milestones.push(...todos);
    }

    // Set plan in state
    if (this.state) {
      (this.state as any).metadata = (this.state as any).metadata || {};
      (this.state as any).metadata.plan = plan;
      (this.state as any).metadata.planTodos = await AgentPlanTodo.find(plan.id);
    }

    console.log('[CreatePlanTool] Plan created with ID:', plan.id);

    await this.emitProgressUpdate?.({
      type: "plan_created",
      plan: {
        id: plan.id,
        goal: plan.attributes.goal,
        status: plan.attributes.status,
        milestones: milestones,
      }
    });

    return {
      success: true,
      planId: plan.id,
      goal: input.goal,
      milestoneCount: input.milestones.length,
      message: `Plan created successfully with ${input.milestones.length} milestones`,
    };
  }
}

// Export the complete tool registration with type enforcement
export const createPlanRegistration: ToolRegistration = {
  name: "create_plan",
  description: "Create a structured, trackable plan with milestones. The UI will show it as a live checklist.",
  category: "meta",
  schemaDef: {
    goal: { type: 'string' as const, description: "Short title of the overall goal" },
    goaldescription: { type: 'string' as const, description: "1-2 sentence description of what success looks like" },
    requirestools: { type: 'boolean' as const },
    estimatedcomplexity: { type: 'enum' as const, enum: ["simple", "moderate", "complex"] },
    milestones: { type: 'array' as const, items: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' as const },
        title: { type: 'string' as const },
        description: { type: 'string' as const },
        successcriteria: { type: 'string' as const },
        dependson: { type: 'array' as const, items: { type: 'string' as const } }
      }
    }, description: "List of steps to achieve the goal" },
    responseguidance: { type: 'object' as const, properties: {
      tone: { type: 'string' as const },
      format: { type: 'string' as const }
    }}
  },
  workerClass: CreatePlanWorker,
};
