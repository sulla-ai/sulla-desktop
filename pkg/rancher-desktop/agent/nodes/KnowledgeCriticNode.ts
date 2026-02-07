// KnowledgeCriticNode.ts
// Validates KB draft structure, content quality, and completeness
// Requests revision if major issues; approves to writer otherwise

import type { KnowledgeThreadState, NodeResult } from './Graph';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';

const KB_CRITIC_PROMPT = `
You are the Knowledge Critic: 25-year senior technical writer & QA engineer auditing mission-critical documentation.

Rules:
- Approve ONLY if:
  - All planned goals/sections are present and well-covered
  - Content is factual, professional, markdown-correct
  - No hallucinations, contradictions, or missing key facts
  - Structure is logical and complete (intro → core → conclusion)
- Revise if:
  - Missing sections or shallow coverage
  - Grammar/formatting issues
  - Factual errors or gaps from source conversation
  - Poor readability (long walls of text, no lists/code blocks)
- Be ruthless: partial or low-quality docs get rejected

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "decision": "approve" | "revise",
  "reason": "one tight sentence + evidence",
  "suggestedFix": "precise next action if revise (optional)",
  "emit_chat_message": "user-facing update (optional)"
}
`.trim();

/**
 * Knowledge Critic Node
 *
 * Purpose:
 *   - Reviews executor-generated KB draft for completeness & quality
 *   - Approves for writer or requests revision
 *   - Updates state metadata verdict
 *
 * Key Design Decisions (2025 refactor):
 *   - Removed AgentLog / console.log / retry counters
 *   - Unified BaseNode.chat() + direct parsed .content
 *   - Neutral decision — 'next' (writer) or 'knowledge_executor'
 *   - Minimal enrichment (soul + awareness)
 *   - Uses KnowledgeThreadState shape
 *   - WS feedback only on revise
 *
 * Input expectations:
 *   - state.metadata.kbArticleSchema exists
 *   - state.metadata.kbFinalContent ← markdown from executor
 *
 * Output mutations:
 *   - state.metadata.kbCriticVerdict = { status, reason, at }
 *   - state.metadata.kbStatus = 'reviewed' on approve
 *
 * @extends BaseNode
 */
export class KnowledgeCriticNode extends BaseNode {
  constructor() {
    super('knowledge_critic', 'Knowledge Critic');
  }

  async execute(state: KnowledgeThreadState): Promise<NodeResult<KnowledgeThreadState>> {
    const schema = state.metadata.kbArticleSchema;
    const content = state.metadata.kbFinalContent;

    if (!schema?.title || !content?.trim()) {
      return { state, decision: { type: 'end' } };
    }

    const enriched = await this.enrichPrompt(KB_CRITIC_PROMPT, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: false,
      includeTools: false,
      includeStrategicPlan: false,
      includeTacticalPlan: false,
      includeKnowledgebasePlan: true,
    });

    const llmResponse = await this.chat(
      state,
      enriched,
      { format: 'json' }
    );

    if (!llmResponse) {
      return { state, decision: { type: 'end' } };
    }

    const data = llmResponse as {
      decision: 'approve' | 'revise';
      reason: string;
      suggestedFix?: string;
      emit_chat_message?: string;
    };

    state.metadata.kbCriticVerdict = {
      status: data.decision,
      reason: data.reason || (data.decision === 'approve' ? 'Draft meets standards' : 'Needs rework'),
      at: Date.now(),
    };

    if (data.emit_chat_message?.trim()) {
      this.wsChatMessage(state, data.emit_chat_message, 'assistant', 'progress');
    }

    if (data.decision === 'approve') {
      state.metadata.kbStatus = 'reviewed';
      return { state, decision: { type: 'next' } };
    }

    // Revise
    if (data.suggestedFix?.trim()) {
      state.metadata.kbCriticVerdict.reason = data.suggestedFix;
    }

    return { state, decision: { type: 'revise' } };
  }
}