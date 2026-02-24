import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { getWebSocketClientService } from '../../services/WebSocketClientService';

type PlanStatus = 'active' | 'completed';
type MilestoneStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

interface InputMilestone {
  id?: string;
  title?: string;
  description?: string;
  successcriteria?: string;
  dependson?: string[];
}

interface FrontendMilestone {
  id: string;
  title: string;
  description: string;
  successcriteria: string;
  dependson: string[];
  orderIndex: number;
  status: MilestoneStatus;
  note?: string;
}

interface FrontendPlan {
  id: string;
  threadId: string;
  wsChannel: string;
  goal: string;
  goaldescription: string;
  requirestools: boolean;
  complexity: 'simple' | 'moderate' | 'complex';
  status: PlanStatus;
  createdAt: number;
  milestones: FrontendMilestone[];
}

/**
 * Create Plan Tool - Worker class for execution
 */
export class CreatePlanWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    console.log('[CreatePlanTool] updatePlan started');

    const threadId = String((this.state as any).metadata?.threadId || 'unknown-thread');
    const wsChannel = String((this.state as any).metadata?.wsChannel || 'unknown-channel');
    const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const milestonesInput: InputMilestone[] = Array.isArray(input?.milestones)
      ? input.milestones
      : [];

    const milestones: FrontendMilestone[] = milestonesInput.map((milestone: InputMilestone, index: number) => ({
      id: String(milestone.id || `milestone_${index + 1}`),
      title: String(milestone.title || `Milestone ${index + 1}`),
      description: String(milestone.description || ''),
      successcriteria: String(milestone.successcriteria || ''),
      dependson: Array.isArray(milestone.dependson) ? milestone.dependson.map(String) : [],
      orderIndex: index,
      status: 'pending',
    }));

    const plan: FrontendPlan = {
      id: planId,
      threadId,
      wsChannel,
      goal: String(input?.goal || ''),
      goaldescription: String(input?.goaldescription || ''),
      requirestools: Boolean(input?.requirestools),
      complexity: (input?.estimatedcomplexity || 'moderate') as 'simple' | 'moderate' | 'complex',
      status: 'active',
      createdAt: Date.now(),
      milestones,
    };

    // Set plan in state
    if (this.state) {
      (this.state as any).metadata = (this.state as any).metadata || {};
      (this.state as any).metadata.plan = plan;
      (this.state as any).metadata.planTodos = milestones;
    }

    await this.emitProgressUpdate?.({
      type: "plan_created",
      plan,
    });

    // Explicit legacy progress event for UI plan handlers (AgentPersonaModel expects data.phase)
    await getWebSocketClientService().send(wsChannel, {
      type: 'progress',
      threadId,
      data: {
        phase: 'plan_created',
        planId,
        goal: plan.goal,
        plan,
      },
      timestamp: Date.now(),
    });

    return {
      successBoolean: true,
      responseString: `Plan created (id:${planId}) successfully with ${milestones.length} milestones`
    };
  }
}

// Export the complete tool registration with type enforcement
export const createPlanRegistration: ToolRegistration = {
  name: "create_plan",
  description: "Create a structured, trackable plan with milestones. The UI will show it as a live checklist.",
  category: "meta",
  operationTypes: ['read','create','update','delete'],
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
