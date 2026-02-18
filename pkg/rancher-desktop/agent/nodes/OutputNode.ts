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

Progress Details:
{{progressSummary}}

Evidence Collected:
{{evidenceDetails}}

{{criticEvaluation}}

Create a comprehensive completion report that helps the user understand:
1. What was accomplished
2. How well it aligns with skill requirements
3. What evidence supports the completion
4. What they should do next (if anything)

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "taskStatus": "completed" | "partial" | "failed",
  "completionScore": 0,                    // 0-10 integer (how well task was completed)
  "skillCompliance": 0,                    // 0-10 integer (adherence to skill template)
  "summaryMessage": "Clear user-facing completion summary",
  "accomplishments": ["list", "of", "completed", "items"],
  "evidenceHighlights": ["key", "evidence", "pieces"],
  "nextSteps": ["recommended", "next", "actions"],
  "skillFeedback": "Assessment of skill template execution",
  "emit_chat_message": "Final message to user with results"
}
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

    const plannerData = (state.metadata as any).planner || {};
    const actionsData = (state.metadata as any).actions || [];
    const reasoningData = (state.metadata as any).reasoning || {};
    const criticData = (state.metadata as any).skillCritic || null;
    const planRetrievalData = (state.metadata as any).planRetrieval || {};
    const cycleCount = (state.metadata as any).reactLoopCount || 0;

    // Extract output context
    const context = this.extractOutputContext(
      plannerData, 
      actionsData, 
      reasoningData, 
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

    const llmResponse = await this.chat(state, enriched);

    let outputData;
    if (!llmResponse) {
      // Fallback output if LLM fails
      outputData = this.createFallbackOutput(context);
    } else {
      outputData = llmResponse as {
        taskStatus: 'completed' | 'partial' | 'failed';
        completionScore: number;
        skillCompliance: number;
        summaryMessage: string;
        accomplishments: string[];
        evidenceHighlights: string[];
        nextSteps: string[];
        skillFeedback: string;
      };
    }

    // Store output results in state
    (state.metadata as any).output = {
      ...outputData,
      generatedAt: Date.now(),
      cycleCount,
      actionCount: actionsData.length,
      evidenceCount: this.countEvidence(actionsData)
    };

    // Mark task as complete and ready for user
    (state.metadata as any).cycleComplete = true;
    (state.metadata as any).waitingForUser = true;
    (state.metadata as any).finalState = outputData.taskStatus;

    console.log(`[Output] Task ${outputData.taskStatus} (Score: ${outputData.completionScore}/10, Skill: ${outputData.skillCompliance}/10)`);
    console.log(`[Output] ${outputData.summaryMessage}`);

    return { state, decision: { type: 'end' } };
  }

  /**
   * Extract context for output generation
   */
  private extractOutputContext(
    plannerData: any, 
    actionsData: any[], 
    reasoningData: any, 
    criticData: any, 
    planRetrievalData: any,
    cycleCount: number
  ) {
    const goal = plannerData.goal || 'Unknown goal';
    const skillData = planRetrievalData.skillData || null;
    
    // Determine final status
    let finalStatus = 'completed';
    if (criticData) {
      finalStatus = criticData.decision === 'complete' ? 'completed' : 'partial';
    } else if (reasoningData.currentDecision) {
      finalStatus = reasoningData.currentDecision.stop_condition_met ? 'completed' : 'partial';
    }

    // Count evidence and actions
    const actionCount = actionsData.length;
    const evidenceCount = this.countEvidence(actionsData);
    
    // Extract evidence details
    const evidenceDetails = this.extractEvidenceDetails(actionsData);
    
    // Create progress summary
    const progressSummary = this.createProgressSummary(actionsData, reasoningData, cycleCount);

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
  private createProgressSummary(actionsData: any[], reasoningData: any, cycleCount: number): string {
    const successfulActions = actionsData.filter(action => action.success).length;
    const failedActions = actionsData.length - successfulActions;
    
    const summary = [
      `Total ReAct cycles: ${cycleCount}`,
      `Successful actions: ${successfulActions}`,
      failedActions > 0 ? `Failed actions: ${failedActions}` : null,
      reasoningData.currentDecision ? `Final reasoning: ${reasoningData.currentDecision.action_type}` : null
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
