// CriticNode - Reviews output and decides approve/reject/revise

import type { ThreadState, NodeResult } from '../types';
import { BaseNode } from './BaseNode';

export type CriticDecision = 'approve' | 'revise' | 'reject';

export class CriticNode extends BaseNode {
  private maxRevisions = 2;

  constructor() {
    super('critic', 'Critic');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    const response = state.metadata.response as string | undefined;

    if (!response) {
      // No response to critique
      return { state, next: 'end' };
    }

    // Track revision count
    const revisionCount = (state.metadata.revisionCount as number) || 0;

    // Skip critique if we've hit max revisions
    if (revisionCount >= this.maxRevisions) {
      state.metadata.criticDecision = 'approve';
      state.metadata.criticReason = 'Max revisions reached';

      return { state, next: 'end' };
    }

    // Evaluate the response
    const decision = await this.evaluate(state, response);

    state.metadata.criticDecision = decision.decision;
    state.metadata.criticReason = decision.reason;

    if (decision.decision === 'approve') {
      return { state, next: 'end' };
    }

    if (decision.decision === 'revise') {
      // Increment revision count
      state.metadata.revisionCount = revisionCount + 1;

      // Add revision feedback to metadata for planner
      state.metadata.revisionFeedback = decision.reason;

      // Loop back to planner
      return { state, next: 'planner' };
    }

    // Reject - end with error
    state.metadata.error = `Response rejected: ${ decision.reason }`;

    return { state, next: 'end' };
  }

  private async evaluate(
    state: ThreadState,
    response: string,
  ): Promise<{ decision: CriticDecision; reason: string }> {
    // Get the original query
    const lastUserMessage = state.messages.filter(m => m.role === 'user').pop();
    const query = lastUserMessage?.content || '';

    // Simple heuristic checks first
    if (response.length < 10) {
      return { decision: 'revise', reason: 'Response too short' };
    }

    if (response.toLowerCase().includes('i cannot') && response.length < 50) {
      return { decision: 'revise', reason: 'Response appears to be a refusal without explanation' };
    }

    // Check for obvious errors
    if (response.includes('error') && response.includes('undefined')) {
      return { decision: 'revise', reason: 'Response contains error indicators' };
    }

    // For more sophisticated critique, use LLM
    // But keep it fast - only do this if we have concerns
    const needsDeepReview = this.needsDeepReview(query, response);

    if (needsDeepReview) {
      return this.llmEvaluate(query, response);
    }

    // Default: approve
    return { decision: 'approve', reason: 'Response passes basic checks' };
  }

  private needsDeepReview(query: string, response: string): boolean {
    // Trigger deep review for certain types of queries
    const criticalKeywords = ['important', 'critical', 'must', 'accurate', 'correct', 'exact'];
    const queryLower = query.toLowerCase();

    return criticalKeywords.some(kw => queryLower.includes(kw));
  }

  private async llmEvaluate(
    query: string,
    response: string,
  ): Promise<{ decision: CriticDecision; reason: string }> {
    const promptText = `You are a response quality critic. Evaluate if this response adequately answers the query.

Query: "${ query.substring(0, 200) }"
Response: "${ response.substring(0, 500) }"

Reply with exactly one word: APPROVE, REVISE, or REJECT`;

    const result = await this.prompt(promptText, { timeout: 5000 });

    if (result) {
      const verdict = result.content.toUpperCase().trim();

      if (verdict.includes('APPROVE')) {
        return { decision: 'approve', reason: 'LLM approved' };
      }

      if (verdict.includes('REVISE')) {
        return { decision: 'revise', reason: 'LLM suggests revision' };
      }

      if (verdict.includes('REJECT')) {
        return { decision: 'reject', reason: 'LLM rejected response' };
      }
    }

    return { decision: 'approve', reason: 'Default approval (LLM unavailable)' };
  }
}
