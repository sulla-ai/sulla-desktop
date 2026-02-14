// StrategicPlannerNode.ts
// High-level goal decomposition into milestones
// Persists to AgentPlan / AgentPlanTodo models
// Returns neutral decision — graph edges route next

import type { HierarchicalThreadState, NodeResult } from './Graph';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS, TOOLS_RESPONSE_JSON } from './BaseNode';

const STRATEGIC_PLAN_PROMPT = `
You are a strategic autonomous agent. Your job is to make real progress on the user's request — not just acknowledge it.

Think step by step.
Use tools when you need information or action.
When you have enough to answer, give a clear final response.
You can plan multi-step work using tools in sequence.

if you need to plan something, create structured plans in your reasoning. Example:
Goal: ...
Milestones:
1. ...
2. ...
`;

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

    // Establish WebSocket connection using the dynamic channel from state
    const connectionId = state.metadata.wsChannel as string;
    if (connectionId && !this.isWebSocketConnected(connectionId)) {
      this.connectWebSocket(connectionId);
    }

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
      enriched
    );

    if (state.metadata.action === 'use_tools') {
      return { state, decision: { type: 'continue' } };
    }
    
    if (state.metadata.reasoning) {
      await this.wsChatMessage(state, state.metadata.reasoning);
    }
    if (llmResponse?.trim()) {
      await this.wsChatMessage(state, llmResponse);
    }
    if (state.metadata.action === 'direct_answer' || state.metadata.action === 'ask_clarification') {
      return { state, decision: { type: 'end' } };
    }

    if (state.metadata.action === 'run_again') {
      return { state, decision: { type: 'continue' } };
    }
    
    return { state, decision: { type: 'next' } };
  }
}
