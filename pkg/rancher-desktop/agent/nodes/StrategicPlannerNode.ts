// StrategicPlannerNode.ts
// High-level goal decomposition into milestones
// Persists to AgentPlan / AgentPlanTodo models
// Returns neutral decision — graph edges route next

import type { HierarchicalThreadState, NodeResult } from './Graph';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { AgentPlan, AgentPlanInterface } from '../database/models/AgentPlan';
import { AgentPlanTodo, AgentPlanTodoInterface } from '../database/models/AgentPlanTodo';

const STRATEGIC_PLAN_PROMPT = `
For this request you're job is to be the StrategicPlannerNode in a hierarchical LangGraph agent.

Think like a 20+ year battle-tested strategist: Amazon predictive scaling (40% efficiency), Zappos personalization (30% repeat rate), nonprofit SWOT pivots (25% donation lift). Avoid generic fluff. Focus on high-leverage, low-risk sequences with proven multipliers.

Core Rules:
- If the user goal needs >1 meaningful step → planNeeded: true
- If simple/direct answer suffices → planNeeded: false + emit_chat_message = full response
- Never ask questions
- Never call tools yourself
- Prefer 3–6 tight milestones max
- Each milestone must have clear success criteria (SMARTER style)
- Include 1–2 stretch/enhancement ideas where high ROI possible

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "goal": "One-sentence primary objective",
  "goalDescription": "What true success looks like",
  "requiresTools": boolean,
  "estimatedComplexity": "simple" | "moderate" | "complex",
  "planNeeded": boolean,
  "milestones": [
    {
      "id": "m1",
      "title": "Short actionable title",
      "description": "What this step achieves",
      "successCriteria": "Measurable completion condition",
      "dependsOn": ["m0"]   // empty array if none
    }
  ],
  "responseGuidance": {
    "tone": "technical" | "casual" | "formal" | "friendly",
    "format": "brief" | "detailed" | "markdown" | "conversational"
  },
  "emit_chat_message": "Optional message to show user immediately (only if planNeeded)"
}`;

/**
 * Strategic Planner Node
 *
 * Purpose:
 *   - Decomposes user intent into high-level goal + milestones
 *   - Persists plan to DB (AgentPlan + AgentPlanTodo)
 *   - Activates first milestone if plan created
 *   - Handles simple vs multi-step paths
 *
 * Key Design Decisions (2025 refactor):
 *   - Removed AgentLog / console.log / agentWarn
 *   - Unified BaseNode.chat() + direct parsed .content access
 *   - Enrichment: soul + awareness + memory + tools (names only)
 *   - Persists via AgentPlan / AgentPlanTodo models directly
 *   - Neutral decision only — graph edges decide next
 *   - WS feedback only on plan creation / simple response
 *   - No retry counter bloat — graph-level protection
 *
 * Input expectations:
 *   - Recent user message in state.messages
 *   - HierarchicalThreadState shape
 *
 * Output mutations:
 *   - state.metadata.plan ← { model, milestones[], activeMilestoneIndex, allMilestonesComplete }
 *   - DB: new/existing AgentPlan + AgentPlanTodo records
 *   - state.metadata.activeMilestoneIndex = 0 on new plan
 *
 * @extends BaseNode
 */
export class StrategicPlannerNode extends BaseNode {
  constructor() {
    super('strategic_planner', 'Strategic Planner');
  }

  async execute(state: HierarchicalThreadState): Promise<NodeResult<HierarchicalThreadState>> {

    const enriched = await this.enrichPrompt(STRATEGIC_PLAN_PROMPT, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: true,
      includeTools: true,
      includeStrategicPlan: false,
      includeTacticalPlan: false,
      includeKnowledgebasePlan: false,
    });

    const llmResponse = await this.chat(
      state,
      enriched,
      { format: 'json' }
    );

    if (!llmResponse) {
      return { state, decision: { type: 'continue' } };
    }

    const plan = llmResponse as StrategicPlan;
    if (!plan || !plan.goal?.trim()) {
      return { state, decision: { type: 'continue' } };
    }

    if (plan.emit_chat_message?.trim()) {
      this.wsChatMessage(state, plan.emit_chat_message, 'assistant', 'response');
    }

    // ============================================================================
    // No complete plan needed
    // ============================================================================

    if (!plan.planNeeded) {
      return { state, decision: { type: 'end' } };
    }


    // ============================================================================
    // Thorough thought processes need to carry out this task
    // First task is to get or update the plan
    // ============================================================================

    try {
      // check if the plan is already in the state object
      let planModel = state.metadata.plan?.model;
      if (planModel) {

        planModel.fill({
          thread_id: state.metadata.threadId,
          status: 'active',
          goal: plan.goal,
          goalDescription: plan.goalDescription,
          complexity: plan.estimatedComplexity,
          requiresTools: plan.requiresTools,
          wsChannel: state.metadata.wsChannel,
        });
        await planModel.incrementRevision();
        await planModel.deleteAllTodos();

        console.log('[StrategicPlanner] edit Plan created:', planModel.attributes);

      // Create a new plan
      } else {

        planModel = new AgentPlan();
        planModel.fill({
          thread_id: state.metadata.threadId,
          status: 'active',
          goal: plan.goal,
          goalDescription: plan.goalDescription,
          complexity: plan.estimatedComplexity,
          requiresTools: plan.requiresTools,
          wsChannel: state.metadata.wsChannel,
        })

        console.log('[StrategicPlanner] create Plan created:', planModel.attributes);

        await planModel.save();
        state.metadata.plan.model = planModel;

      }

      // Create new todos
      const todos: AgentPlanTodo[] = [];
      for (const [idx, m] of plan.milestones.entries()) {
        const todo = new AgentPlanTodo();
        todo.fill({
          plan_id: planModel.attributes.id!,
          title: m.title,
          description: `${m.description}\n\nSuccess: ${m.successCriteria}`,
          order_index: idx,
          status: idx === 0 ? 'in_progress' : 'pending',
        });
        await todo.save();
        todos.push(todo);
      }

      // Update state shape
      state.metadata.plan = {
        model: planModel,
        milestones: todos.map(todo => ({ model: todo })),
        activeMilestoneIndex: 0,
        allMilestonesComplete: false,
      };

      return { state, decision: { type: 'end' } };
    } catch(err) {
      console.error('[StrategicPlanner] Plan persistence failed:', err);
      return { state, decision: { type: 'end' } };
    }
  }
}

interface StrategicPlan {
  goal: string;
  goalDescription: string;
  requiresTools: boolean;
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  planNeeded: boolean;
  milestones: Array<{
    id: string;
    title: string;
    description: string;
    successCriteria: string;
    dependsOn: string[];
  }>;
  responseGuidance: {
    tone: string;
    format: string;
  };
  emit_chat_message?: string;
}