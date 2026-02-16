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

    const threadId = (this.state as any).metadata?.threadId;
    const wsChannel = (this.state as any).metadata?.wsChannel;

    // AgentPlan fillable: thread_id, revision, status, goal, goaldescription, complexity, requirestools, wschannel
    const plan = await AgentPlan.create({
      thread_id: threadId,
      goal: input.goal,
      goaldescription: input.goaldescription,
      requirestools: input.requirestools,
      complexity: input.estimatedcomplexity,
      status: 'active',
      wschannel: wsChannel,
    });

    const planId = plan.attributes.id;
    if (!planId) {
      throw new Error(`Plan creation failed: no id returned. Attributes: ${JSON.stringify(plan.attributes)}`);
    }

    // AgentPlanTodo fillable: plan_id, status, order_index, title, description, category_hints, wschannel
    const createdTodos = [];
    for (let i = 0; i < input.milestones.length; i++) {
      const milestone = input.milestones[i];
      const todo = await AgentPlanTodo.create({
        plan_id: planId,
        title: milestone.title,
        description: milestone.description,
        status: 'pending',
        order_index: i,
        wschannel: wsChannel,
      });
      createdTodos.push(todo);
    }

    // Use the just-created todos
    const milestones = createdTodos;

    // Set plan in state
    if (this.state) {
      (this.state as any).metadata = (this.state as any).metadata || {};
      (this.state as any).metadata.plan = plan;
      (this.state as any).metadata.planTodos = await AgentPlanTodo.findForPlan(planId);
    }

    console.log('[CreatePlanTool] Plan created with ID:', planId);

    await this.emitProgressUpdate?.({
      type: "plan_created",
      plan: {
        id: planId,
        goal: plan.attributes.goal,
        status: plan.attributes.status,
        milestones: milestones,
      }
    });

    return {
      success: true,
      planId: planId,
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
