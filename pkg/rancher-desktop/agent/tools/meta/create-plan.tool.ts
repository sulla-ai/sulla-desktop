import { BaseTool } from "../base";
import { z } from "zod";
import { AgentPlan, PlanStatus } from '../../database/models/AgentPlan';
import { AgentPlanTodo, TodoStatus } from '../../database/models/AgentPlanTodo';

export class CreatePlanTool extends BaseTool {
  name = "create_plan";
  description = "Create a structured, trackable plan with milestones. The UI will show it as a live checklist.";
  schema = z.object({
    goal: z.string().describe("Short title of the overall goal"),
    goaldescription: z.string().describe("1-2 sentence description of what success looks like"),
    requirestools: z.boolean(),
    estimatedcomplexity: z.enum(["simple", "moderate", "complex"]),
    milestones: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      successcriteria: z.string(),
      dependson: z.array(z.string()),
    })).describe("List of steps to achieve the goal"),
    responseguidance: z.object({
      tone: z.string(),
      format: z.string(),
    }),
  });

  metadata = { category: "meta" };

  protected async _call(input: z.infer<this["schema"]>) {
    console.log('[CreatePlanTool] updatePlan started');
    const metadata = this.state!.metadata! as any;
    metadata.plan = metadata.plan || {};
    console.log('[CreatePlanTool] state.metadata:', JSON.stringify(metadata, null, 2));
    
    // Defensive check for milestones
    if (!input.milestones || !Array.isArray(input.milestones)) {
      console.error('[CreatePlanTool] Invalid milestones:', input.milestones);
      input.milestones = [];
    }
    
    // check if the plan is already in the state object
    let planModel = metadata.plan?.model;
    console.log('[CreatePlanTool] Existing planModel:', planModel ? 'found' : 'not found');
    
    if (planModel) {
      console.log('[CreatePlanTool] Plan already exists:', planModel.attributes);
      console.log('[CreatePlanTool] Plan exists ID:', planModel.attributes.id);

      planModel.fill({
        thread_id: metadata.threadId,
        status: 'active',
        goal: input.goal,
        goaldescription: input.goaldescription,
        complexity: input.estimatedcomplexity,
        requirestools: input.requirestools,
        wschannel: metadata.wsChannel,
      });
      
      console.log('[CreatePlanTool] After fill, plan attributes:', planModel.attributes);
      console.log('[CreatePlanTool] Calling incrementRevision...');
      await planModel.incrementRevision();
      console.log('[CreatePlanTool] incrementRevision completed');
      
      console.log('[CreatePlanTool] Calling deleteAllTodos...');
      await planModel.deleteAllTodos();
      console.log('[CreatePlanTool] deleteAllTodos completed');

    // Create a new plan
    } else {
      console.log('[CreatePlanTool] Creating new plan:', input);
      console.log('[CreatePlanTool] New AgentPlan instance created');
      
      planModel = new AgentPlan();
      console.log('[CreatePlanTool] planModel before fill:', planModel.attributes);
      
      const fillData = {
        thread_id: metadata.threadId,
        status: 'active' as PlanStatus,
        goal: input.goal,
        goaldescription: input.goaldescription,
        complexity: input.estimatedcomplexity,
        requirestools: input.requirestools,
        wschannel: metadata.wsChannel,
      };
      
      console.log('[CreatePlanTool] Fill data for new plan:', fillData);
      planModel.fill(fillData);
      console.log('[CreatePlanTool] planModel after fill:', planModel.attributes);
      console.log('[CreatePlanTool] Calling save on new plan...');
      
      await planModel.save();
      console.log('[CreatePlanTool] New plan saved successfully');
      console.log('[CreatePlanTool] New plan ID after save:', planModel.attributes.id);
      
      metadata.plan.model = planModel;
      console.log('[CreatePlanTool] Plan model stored in state');

    }

    console.log('[CreatePlanTool] Plan created/updated, processing milestones:', input.milestones.length);
    console.log('[CreatePlanTool] Plan model ID for todos:', planModel.attributes.id);

    // Create new todos
    const todos: AgentPlanTodo[] = [];
    for (const [idx, m] of input.milestones.entries()) {
      console.log(`[CreatePlanTool] Processing milestone ${idx}:`, m);
      
      const todo = new AgentPlanTodo();
      console.log(`[CreatePlanTool] Created todo instance for milestone ${idx}`);
      
      const todoData = {
        plan_id: planModel.attributes.id!,
        title: m.title,
        description: `${m.description}\n\nSuccess: ${m.successcriteria}`,
        order_index: idx,
        status: (idx === 0 ? 'in_progress' : 'pending') as TodoStatus,
        wschannel: metadata.wsChannel,
      };
      
      console.log(`[CreatePlanTool] Todo data for milestone ${idx}:`, todoData);
      todo.fill(todoData);
      console.log(`[CreatePlanTool] Todo filled for milestone ${idx}:`, todo.attributes);
      
      console.log(`[CreatePlanTool] Saving todo for milestone ${idx}...`);
      await todo.save();
      console.log(`[CreatePlanTool] Todo saved for milestone ${idx}, ID:`, todo.attributes.id);
      
      todos.push(todo);
    }
    
    console.log('[CreatePlanTool] All todos created:', todos.length);

    // Update state shape
    console.log('[CreatePlanTool] Updating state shape...');
    metadata.plan = {
      model: planModel,
      milestones: todos.map(todo => ({ model: todo })),
      activeMilestoneIndex: 0,
      allMilestonesComplete: false,
    };
    console.log('[CreatePlanTool] State updated successfully');
    console.log('[CreatePlanTool] updatePlan completed');
    
    await this.emitProgressUpdate?.({ type: "plan_created", plan: input });

    return {
      success: true,
      message: `Plan created with ${input.milestones.length} milestones.`
    };
  }
}