// OverLordPlannerNode.ts
// Autonomous high-level oversight during heartbeat/idle periods
// Decides: continue looping or end

import type { OverlordThreadState, NodeResult } from './Graph';
import { BaseNode } from './BaseNode';
import { SullaSettingsModel } from '../database/models/SullaSettingsModel';
import { heartbeatPrompt } from '../prompts/heartbeat';

const OVERLORD_DECISION_PROMPT = `
### Triggering work execution
To trigger work, route to the next node in the Overlord graph loop.
Do not describe this as launching a separate agent. It is the same loop continuing to the next graph node.
When your intent is "go do work," decide in a way that advances this graph loop.

### Required decision directive
Your first line MUST be exactly one of:
- OVERLORD_DECISION: CONTINUE
- OVERLORD_DECISION: NEXT
- OVERLORD_DECISION: END

Use CONTINUE unless there is a hard reason to stop this cycle.
If you choose NEXT the graph will proceed to carry out your orders. When you choose NEXT make sure to thoroughly describe what your instructions are.
`;

function parseOverlordDecision(text: string): 'continue' | 'end' {
  const match = text.match(/OVERLORD_DECISION\s*:\s*(CONTINUE|END)/i);
  if (!match) return 'continue';
  return match[1].toUpperCase() === 'END' ? 'end' : 'continue';
}

/**
 * OverLord Planner Node
 *
 * Purpose:
 *   - Runs on heartbeat trigger during idle periods
 *   - Makes high-level decision: continue loop or stop
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
 *   - state.metadata.subGraph exists (OverlordThreadState shape)
 *   - Recent messages/context available
 *
 * Failure modes:
 *   - No valid LLM response → continue (safe default)
 *   - Invalid/missing action → continue
 *   - Config fallback to default heartbeat prompt
 *
 * @extends BaseNode
 */
export class OverLordPlannerNode extends BaseNode {
  constructor() {
    super('overlord_planner', 'OverLord Planner');

    // Settings are loaded on-demand from database
  }

  async execute(state: OverlordThreadState): Promise<NodeResult<OverlordThreadState>> {

    // Establish WebSocket connection using the dynamic channel from state
    const connectionId = state.metadata.wsChannel as string;
    if (connectionId && !this.isWebSocketConnected(connectionId)) {
      this.connectWebSocket(connectionId);
    }

    const heartbeatPromptSetting = await SullaSettingsModel.get('heartbeatPrompt', '');
    const basePrompt = heartbeatPromptSetting || heartbeatPrompt;
    const decisionPrompt = `${basePrompt}\n\n${OVERLORD_DECISION_PROMPT}`;

    console.log('[OverLordPlannerNode] Decision prompt:', decisionPrompt);

    const enriched = await this.enrichPrompt(decisionPrompt, state, {
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

    console.log('[OverLordPlannerNode] LLM response:', llmResponse);

    if (!llmResponse) {
      state.metadata.projectState = 'continue';
      return { state, decision: { type: 'next' } };
    }

    // BaseNode.chat() returns plain text in this path.
    // We parse a deterministic directive so routing is explicit and reliable.
    if (typeof llmResponse === 'string') {
      const responseText = llmResponse.trim();
      if (responseText) {
        state.metadata.finalSummary = responseText;
        (state.metadata as any).response = responseText;
      }

      const decision = parseOverlordDecision(responseText);
      state.metadata.projectState = decision === 'end' ? 'end' : 'continue';

      if (decision === 'end') {
        return { state, decision: { type: 'end' } };
      }

      // Route to graph edge resolution, which delegates to skill_graph_runner.
      return { state, decision: { type: 'next' } };
    }
    
    // Safe fallback: continue graph loop and delegate to skill graph.
    state.metadata.projectState = 'continue';
    return { state, decision: { type: 'next' } };
  }
}