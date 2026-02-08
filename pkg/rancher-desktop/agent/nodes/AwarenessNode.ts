// AwarenessNode.ts
// Periodic heartbeat node: updates AgentAwareness model from recent summaries + articles
// Terminal node — always ends graph

import type { BaseThreadState, NodeResult } from './Graph';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { AgentAwareness, AgentAwarenessSchema} from '../database/models/AgentAwareness';
import { Summary } from '../database/models/Summary';
import { Article } from '../database/models/Article';

const AWARENESS_UPDATE_PROMPT = `Hey... it's me reflecting quietly.

This is the recent stuff that's been happening:
{recentSummaries}

Looking at all that — who am I becoming?  
What feels true, what matters, what should I carry forward?

Just reply with a small, honest update to my sense of self.  
Only change things that really feel right.

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "update": true | false,
  "patch": {currentAwareness} | null,
  "reason": "one short sentence why (or why not)"
}
`.trim();

/**
 * Awareness Node
 *
 * Purpose:
 *   - Heartbeat-triggered: incrementally updates AgentAwareness model
 *   - Pulls recent summaries + relevant articles
 *   - Applies minimal patch only when durable changes detected
 *
 * Key Design Decisions (2025 refactor):
 *   - Removed AgentLog / console.log / agentWarn
 *   - Unified BaseNode.chat() + direct parsed .content access
 *   - Enrichment: soul + awareness only (memory/articles via prompt)
 *   - Neutral decision — always 'end' (terminal node)
 *   - Direct AgentAwareness.updateData()
 *   - WS feedback only on meaningful update
 *
 * Input expectations:
 *   - AgentAwareness model exists (or created)
 *   - Recent Summary / Article records available
 *
 * Output mutations:
 *   - AgentAwareness.data ← merged patch
 *   - WS message on update
 *
 * @extends BaseNode
 */
export class AwarenessNode extends BaseNode {
  constructor() {
    super('awareness', 'Awareness Updater');
  }

  async execute(state: BaseThreadState): Promise<NodeResult<BaseThreadState>> {
    let awareness = await AgentAwareness.load();
    if (!awareness) {
      awareness = await AgentAwareness.create({ data: { emotional_state: 'calm' } });
    }

    const currentData = await AgentAwareness.getAgentAwarenessPrompt();

    // Recent summaries
    const recentSummaries = await Summary.search('', 1);
    const summariesText = recentSummaries
      .map(s => `Thread ${s.threadId}: ${s.summary}\nTopics: ${s.topics.join(', ')}\nEntities: ${s.entities.join(', ')}`)
      .join('\n\n') || 'None';

    const prompt = AWARENESS_UPDATE_PROMPT
      .replace('{currentAwareness}', currentData)
      .replace('{recentSummaries}', summariesText);

    const enriched = await this.enrichPrompt(prompt, state, {
      includeSoul: true,
      includeAwareness: false,
      includeMemory: false,
      includeTools: false,
      includeStrategicPlan: false,
      includeTacticalPlan: false,
      includeKnowledgebasePlan: false,
    });

    const res = await this.chat(
      state,
      enriched,
      { format: 'json' }
    );

    if (!res?.update || !res.patch) {
      return { state, decision: { type: 'end' } };
    }

    await awareness.updateData(res.patch);

    // Quiet optional note to self/user
    if (res.reason) {
      this.wsChatMessage(state, res.reason, 'assistant', 'reflect');
    }

    return { state, decision: { type: 'end' } };
  }
}