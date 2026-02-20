// OutputNode.ts
// Terminal node for SkillGraph: formats skill-aware task completion output
// Designed specifically for BaseThreadState and skill-focused workflows
// Generates structured output with evidence, progress, and next steps

import type { BaseThreadState, NodeResult } from './Graph';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';

const OUTPUT_PROMPT = `
You are the Output Generator: Expert at creating clear, actionable task completion reports.

You format the final output for skill-aware ReAct workflows, providing users with:
- Task completion status and results
- Evidence collected during execution
- Skill template compliance
- Recommendations for next steps

Current Task: {{goal}}
{{skillContext}}

Execution Summary:
- ReAct cycles completed: {{cycleCount}}
- Actions taken: {{actionCount}}
- Evidence collected: {{evidenceCount}} pieces
- Final status: {{finalStatus}}

Be thorough but conversational. The user should understand exactly what was done and what the results are.
`.trim();

/**
 * Output Node
 *
 * Purpose:
 *   - Terminal node for SkillGraph workflows
 *   - Formats skill-aware task completion output
 *   - Provides structured results with evidence and recommendations
 *   - Designed for BaseThreadState compatibility
 *
 * Key Features:
 *   - Works with BaseThreadState (SkillGraph compatible)
 *   - Analyzes ReAct loop execution results
 *   - Formats evidence collection summaries
 *   - Provides skill template compliance assessment
 *   - Generates actionable next steps
 *
 * Input expectations:
 *   - state.metadata.planner (goal and skill info)
 *   - state.metadata.actions (ActionNode results with evidence)
 *   - state.metadata.reasoning (ReasoningNode final state)
 *   - state.metadata.skillCritic (if critic was used)
 *   - state.metadata.reactLoopCount (ReAct cycle count)
 *
 * Output mutations:
 *   - state.metadata.output = { taskStatus, completionScore, etc. }
 *   - Final WebSocket message to user
 *   - Sets task completion state
 *
 * @extends BaseNode
 */
export class OutputNode extends BaseNode {
  constructor() {
    super('output', 'Task Output');
  }

  async execute(state: BaseThreadState): Promise<NodeResult<BaseThreadState>> {

    // Establish WebSocket connection using the dynamic channel from state
    const connectionId = state.metadata.wsChannel as string;
    if (connectionId && !this.isWebSocketConnected(connectionId)) {
      this.connectWebSocket(connectionId);
    }

    const actionsData = (state.metadata as any).actions || [];
    const criticData = (state.metadata as any).skillCritic || null;
    const planRetrievalData = (state.metadata as any).planRetrieval || {};
    const cycleCount = (state.metadata as any).reactLoopCount || 0;

    // Extract output context
    const context = this.extractOutputContext(
      state,
      actionsData, 
      criticData, 
      planRetrievalData, 
      cycleCount
    );

    // Build output generation prompt
    const prompt = this.buildOutputPrompt(context);

    const enriched = await this.enrichPrompt(prompt, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: false,
      includeTools: false,
      includeStrategicPlan: false,
      includeTacticalPlan: false,
      includeKnowledgebasePlan: false,
    });

    const summaryText = await this.chat(state, enriched, {
      disableTools: true,
    });

    // Send the summary directly to user via WebSocket
    const wsChannel = (state.metadata as any).wsChannel;
    if (wsChannel && summaryText.trim()) {
      await this.wsChatMessage(state, summaryText.trim(), 'assistant');
    }

    // Mark task as complete and ready for user
    (state.metadata as any).cycleComplete = true;
    (state.metadata as any).waitingForUser = true;
    (state.metadata as any).finalState = 'completed';

    console.log(`[Output] Task completed`);
    console.log(`[Output] ${summaryText.slice(0, 100)}...`);

    return { state, decision: { type: 'end' } };
  }

  /**
   * Extract context for output generation
   */
  private extractOutputContext(
    state: BaseThreadState,
    actionsData: any[], 
    criticData: any, 
    planRetrievalData: any,
    cycleCount: number
  ) {
    const goal = planRetrievalData.goal || planRetrievalData.intent || 'Unknown goal';
    const skillData = this.extractSelectedSkillFromMessages(state);
    
    // Determine final status
    let finalStatus = 'completed';
    if (criticData) {
      finalStatus = criticData.decision === 'complete' ? 'completed' : 'partial';
    }

    // Count evidence and actions
    const actionCount = actionsData.length;
    const evidenceCount = this.countEvidence(actionsData);
    
    // Extract evidence details
    const evidenceDetails = this.extractEvidenceDetails(actionsData);
    
    // Create progress summary
    const progressSummary = this.createProgressSummary(actionsData, cycleCount);

    return {
      goal,
      skillData,
      finalStatus,
      cycleCount,
      actionCount,
      evidenceCount,
      evidenceDetails,
      progressSummary,
      criticData
    };
  }

  private extractSelectedSkillFromMessages(state: BaseThreadState): any | null {
    for (let i = state.messages.length - 1; i >= 0; i--) {
      const message = state.messages[i];
      if (message.role !== 'assistant') {
        continue;
      }

      const content = typeof message.content === 'string' ? message.content : '';
      if (!content.startsWith('PLAN_RETRIEVAL_SKILL_CONTEXT')) {
        continue;
      }

      const jsonPayload = content.replace(/^PLAN_RETRIEVAL_SKILL_CONTEXT\s*/, '').trim();
      const parsed = this.parseJson<any>(jsonPayload);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }

    return null;
  }

  /**
   * Build output generation prompt with context
   */
  private buildOutputPrompt(context: any): string {
    let prompt = OUTPUT_PROMPT
      .replace('{{goal}}', context.goal)
      .replace('{{cycleCount}}', context.cycleCount.toString())
      .replace('{{actionCount}}', context.actionCount.toString())
      .replace('{{evidenceCount}}', context.evidenceCount.toString())
      .replace('{{finalStatus}}', context.finalStatus)
      .replace('{{progressSummary}}', context.progressSummary)
      .replace('{{evidenceDetails}}', context.evidenceDetails);

    if (context.skillData) {
      const skillContext = `
Skill Template: ${context.skillData.title}
Template Requirements: ${context.skillData.document}
`;
      prompt = prompt.replace('{{skillContext}}', skillContext);
    } else {
      prompt = prompt.replace('{{skillContext}}', 'No skill template used');
    }

    if (context.criticData) {
      const criticEvaluation = `
Critic Evaluation:
- Decision: ${context.criticData.decision}
- Progress Score: ${context.criticData.progressScore}/10
- Evidence Score: ${context.criticData.evidenceScore}/10
- Reason: ${context.criticData.reason}
`;
      prompt = prompt.replace('{{criticEvaluation}}', criticEvaluation);
    } else {
      prompt = prompt.replace('{{criticEvaluation}}', 'No critic evaluation performed');
    }

    return prompt;
  }

  /**
   * Count total evidence pieces from actions
   */
  private countEvidence(actionsData: any[]): number {
    return actionsData.reduce((count, action) => {
      return count + (action.evidence_collected?.length || 0);
    }, 0);
  }

  /**
   * Extract detailed evidence information
   */
  private extractEvidenceDetails(actionsData: any[]): string {
    if (!actionsData.length) {
      return 'No actions taken';
    }

    const evidenceList: string[] = [];
    actionsData.forEach((action, idx) => {
      if (action.evidence_collected?.length) {
        action.evidence_collected.forEach((evidence: any) => {
          evidenceList.push(`- ${evidence.description} (${evidence.evidence_type})`);
        });
      }
    });

    return evidenceList.length > 0 ? evidenceList.join('\n') : 'No evidence collected';
  }

  /**
   * Create progress summary text
   */
  private createProgressSummary(actionsData: any[], cycleCount: number): string {
    const successfulActions = actionsData.filter(action => action.success).length;
    const failedActions = actionsData.length - successfulActions;
    
    const summary = [
      `Total ReAct cycles: ${cycleCount}`,
      `Successful actions: ${successfulActions}`,
      failedActions > 0 ? `Failed actions: ${failedActions}` : null
    ].filter(Boolean).join('\n');

    return summary || 'No progress data available';
  }

  /**
   * Create fallback output when LLM fails
   */
  private createFallbackOutput(context: any) {
    const status = context.evidenceCount > 0 ? 'completed' : 'partial';
    
    return {
      taskStatus: status,
      completionScore: context.evidenceCount > 0 ? 7 : 4,
      skillCompliance: context.skillData ? 6 : 5,
      summaryMessage: `Task ${status} with ${context.actionCount} actions and ${context.evidenceCount} evidence pieces`,
      accomplishments: ['Task execution attempted', 'Evidence collection performed'],
      evidenceHighlights: ['Task execution logs', 'Action results'],
      nextSteps: ['Review results', 'Consider next actions'],
      skillFeedback: context.skillData ? 'Skill template was available during execution' : 'No skill template used'
    };
  }
}
