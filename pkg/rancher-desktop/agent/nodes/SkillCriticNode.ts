// SkillCriticNode.ts
// Reviews ReAct loop progress and decides: continue / revise / complete
// Specifically designed for SkillGraph with BaseThreadState
// Evaluates reasoning-action cycles and skill progress

import type { BaseThreadState, NodeResult } from './Graph';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';

const SKILL_CRITIC_PROMPT = `
You are the Skill Critic: Expert evaluator for skill-aware ReAct loops.

You review reasoning-action cycles to determine if the agent should continue, revise approach, or complete the task.

Current Goal: {{goal}}
{{skillContext}}

ReAct Loop Progress:
- Total cycles completed: {{cycleCount}}
- Current step: {{currentStep}}
- Last reasoning: {{lastReasoning}}
- Last action result: {{lastActionResult}}
- Evidence collected: {{evidenceCount}} pieces

Skill Progress:
{{skillProgress}}

Rules:
1. CONTINUE: If making good progress toward skill objectives (< 5 cycles)
2. REVISE: If stuck, poor results, or wrong approach (any cycle count)  
3. COMPLETE: If skill objectives are met with solid evidence (any cycle count)
4. Consider evidence quality - file creation, API responses, data analysis
5. Evaluate if the approach aligns with skill template requirements

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "progressScore": 0,                    // 0-10 integer (progress toward goal)
  "evidenceScore": 0,                    // 0-10 integer (quality of evidence)
  "decision": "continue" | "revise" | "complete",
  "reason": "Clear explanation of decision with evidence",
  "nextAction": "Suggested next step if continuing/revising",
  "completionJustification": "Why task is complete (if applicable)",
  "emit_chat_message": "Update user on ReAct loop progress"
}
`.trim();

/**
 * Skill Critic Node
 *
 * Purpose:
 *   - Evaluates ReAct loop progress (reasoning + action cycles)
 *   - Decides whether to continue loop, revise approach, or complete task
 *   - Considers skill template compliance and evidence quality
 *   - Prevents infinite loops by evaluating progress after X cycles
 *
 * Key Features:
 *   - Works with BaseThreadState (compatible with SkillGraph)
 *   - Analyzes reasoning-action cycle effectiveness
 *   - Evaluates evidence collection quality
 *   - Makes routing decisions for graph flow
 *   - Skill-aware evaluation against templates
 *
 * Input expectations:
 *   - state.metadata.reasoning (ReasoningNode results)
 *   - state.metadata.actions (ActionNode results with evidence)
 *   - state.metadata.planner (goal and skill info)
 *   - Multiple ReAct cycles have occurred
 *
 * Output mutations:
 *   - state.metadata.skillCritic = { decision, reason, progressScore, evidenceScore }
 *   - Routes to: reasoning (continue), planner (revise), or summary (complete)
 *
 * @extends BaseNode
 */
export class SkillCriticNode extends BaseNode {
  constructor() {
    super('skill_critic', 'Skill Critic');
  }

  async execute(state: BaseThreadState): Promise<NodeResult<BaseThreadState>> {

    // Establish WebSocket connection using the dynamic channel from state
    const connectionId = state.metadata.wsChannel as string;
    if (connectionId && !this.isWebSocketConnected(connectionId)) {
      this.connectWebSocket(connectionId);
    }

    const plannerData = (state.metadata as any).planner || {};
    const reasoningData = (state.metadata as any).reasoning || {};
    const actionsData = (state.metadata as any).actions || [];
    const planRetrievalData = (state.metadata as any).planRetrieval || {};

    // Extract evaluation context
    const context = this.extractCriticContext(state, plannerData, reasoningData, actionsData, planRetrievalData);

    if (!context.goal) {
      console.log('[SkillCritic] No goal found, defaulting to complete');
      return { state, decision: { type: 'next' } };
    }

    // Build evaluation prompt
    const prompt = this.buildCriticPrompt(context);

    const enriched = await this.enrichPrompt(prompt, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: false,
      includeTools: false,
      includeStrategicPlan: false,
      includeTacticalPlan: false,
      includeKnowledgebasePlan: false,
    });

    const llmResponse = await this.chat(state, enriched);

    if (!llmResponse) {
      // Fallback decision if LLM fails
      const fallbackDecision = context.cycleCount >= 5 ? 'complete' : 'continue';
      (state.metadata as any).skillCritic = {
        decision: fallbackDecision,
        reason: 'LLM response failed, using fallback logic',
        progressScore: context.cycleCount >= 3 ? 7 : 4,
        evidenceScore: context.evidenceCount > 0 ? 6 : 2
      };
      return { state, decision: { type: 'next' } };
    }

    const data = llmResponse as {
      progressScore: number;
      evidenceScore: number;
      decision: 'continue' | 'revise' | 'complete';
      reason: string;
      nextAction?: string;
      completionJustification?: string;
    };

    // Store critic decision in state
    (state.metadata as any).skillCritic = {
      decision: data.decision,
      reason: data.reason,
      progressScore: data.progressScore || 5,
      evidenceScore: data.evidenceScore || 5,
      nextAction: data.nextAction,
      completionJustification: data.completionJustification,
      evaluatedAt: Date.now()
    };

    console.log(`[SkillCritic] Decision: ${data.decision} (Progress: ${data.progressScore}/10, Evidence: ${data.evidenceScore}/10)`);
    console.log(`[SkillCritic] Reason: ${data.reason}`);

    return { state, decision: { type: 'next' } };
  }

  /**
   * Extract context for critic evaluation
   */
  private extractCriticContext(state: BaseThreadState, plannerData: any, reasoningData: any, actionsData: any[], planRetrievalData: any) {
    const goal = plannerData.goal || 'Unknown goal';
    const skillData = planRetrievalData.skillData || null;
    
    // Count ReAct cycles (reasoning + action pairs)
    const cycleCount = Math.min(
      reasoningData.currentDecision ? 1 : 0,
      actionsData.length
    );

    // Extract evidence count
    const evidenceCount = actionsData.reduce((count, action) => {
      return count + (action.evidence_collected?.length || 0);
    }, 0);

    const lastAction = actionsData[actionsData.length - 1];
    const currentStep = plannerData.plan_steps?.[0] || 'Unknown step';

    return {
      goal,
      skillData,
      cycleCount,
      evidenceCount,
      currentStep,
      lastReasoning: reasoningData.currentDecision?.reasoning || 'No reasoning available',
      lastActionResult: lastAction?.result || 'No action result available',
      skillProgress: this.summarizeSkillProgress(reasoningData, actionsData, skillData)
    };
  }

  /**
   * Build critic evaluation prompt with context
   */
  private buildCriticPrompt(context: any): string {
    let prompt = SKILL_CRITIC_PROMPT
      .replace('{{goal}}', context.goal)
      .replace('{{cycleCount}}', context.cycleCount.toString())
      .replace('{{currentStep}}', context.currentStep)
      .replace('{{lastReasoning}}', context.lastReasoning)
      .replace('{{lastActionResult}}', JSON.stringify(context.lastActionResult))
      .replace('{{evidenceCount}}', context.evidenceCount.toString())
      .replace('{{skillProgress}}', context.skillProgress);

    if (context.skillData) {
      const skillContext = `
Skill Template: ${context.skillData.title}
Template Steps: ${context.skillData.document}
`;
      prompt = prompt.replace('{{skillContext}}', skillContext);
    } else {
      prompt = prompt.replace('{{skillContext}}', 'No skill template loaded');
    }

    return prompt;
  }

  /**
   * Summarize skill progress for critic evaluation
   */
  private summarizeSkillProgress(reasoningData: any, actionsData: any[], skillData: any): string {
    if (!skillData) {
      return 'No skill template - evaluating general progress';
    }

    const completedActions = actionsData.filter(action => action.success).length;
    const failedActions = actionsData.length - completedActions;
    
    return `
- Actions completed: ${completedActions}
- Actions failed: ${failedActions}
- Evidence pieces: ${actionsData.reduce((sum, action) => sum + (action.evidence_collected?.length || 0), 0)}
- Current reasoning state: ${reasoningData.currentDecision?.action_type || 'unknown'}
`;
  }
}
