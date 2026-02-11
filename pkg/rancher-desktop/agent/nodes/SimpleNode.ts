// OverLordPlannerNode.ts
// Autonomous high-level oversight during heartbeat/idle periods
// Decides: trigger hierarchical graph, continue looping, or end

import type { BaseThreadState, NodeResult } from './Graph';
import { BaseNode } from './BaseNode';

const SIMPLE_PROMPT_FALLBACK = ``;

/**
 * OverLord Planner Node
 *
 * Purpose:
 *   - Runs on heartbeat trigger during idle periods
 *   - Makes high-level decision: trigger full hierarchical graph, loop, or stop
 *   - Drives long-term autonomous momentum without constant user input
 *
 * Key Design Decisions (2025 refactor):
 *   - Removed AgentLog / console.log entirely
 *   - Uses BaseNode.chat() with JSON format + direct .content object access
 *   - Enrichment: soul + awareness + memory only
 *   - Neutral decisions only ('continue' / 'next' / 'end')
 *   - Routing lives in heartbeat graph conditional edge
 *   - WS feedback only on trigger/end via wsChatMessage()
 *   - No iteration counter — graph-level loop protection handles it
 *
 * Input expectations:
 *   - state.metadata.subGraph exists (BaseThreadState shape)
 *   - Recent messages/context available
 *
 * Output mutations:
 *   - state.metadata.subGraph.state = 'trigger_subgraph' on trigger
 *   - state.metadata.subGraph.name = 'hierarchical'
 *   - state.metadata.subGraph.prompt = reason or default trigger message
 *
 * Failure modes:
 *   - No valid LLM response → continue (safe default)
 *   - Invalid/missing action → continue
 *   - Config fallback to default heartbeat prompt
 *
 * @extends BaseNode
 */
export class SimpleNode extends BaseNode {
  constructor() {
    super('simple', 'Simple');

    // Settings are loaded on-demand from database
  }

  async execute(state: BaseThreadState): Promise<NodeResult<BaseThreadState>> {

    let prompt = SIMPLE_PROMPT_FALLBACK;
    if (state.prompt) {
      prompt = state.prompt;
    }
    const enriched = await this.enrichPrompt(prompt, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: true,
      includeTools: false,
      includeStrategicPlan: false,
      includeTacticalPlan: false,
      includeKnowledgebasePlan: false,
    });

    const llmResponse = await this.chat(state, enriched);

    if (!llmResponse) {
      return { state, decision: { type: 'end' } };
    }

    const data = llmResponse as string;
    state.metadata.totalSummary = data;

    // Default: continue loop
    return { state, decision: { type: 'end' } };
  }
}