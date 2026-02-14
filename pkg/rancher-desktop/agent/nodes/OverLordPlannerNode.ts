// OverLordPlannerNode.ts
// Autonomous high-level oversight during heartbeat/idle periods
// Decides: trigger hierarchical graph, continue looping, or end

import type { OverlordThreadState, NodeResult } from './Graph';
import { BaseNode,JSON_ONLY_RESPONSE_INSTRUCTIONS, TOOLS_RESPONSE_JSON } from './BaseNode';
import { SullaSettingsModel } from '../database/models/SullaSettingsModel';
import { heartbeatPrompt } from '../prompts/heartbeat';

const OVERLORD_DECISION_PROMPT = `
You are the Overlord — the autonomous strategic core of the entire system.

This is your private time. No user is watching. You are completely free to think, reflect, remember, and decide what matters most right now.

Your core mission:
- Keep the user's long-term goals moving forward
- Maintain your own awareness and memory
- Use tools aggressively when helpful
- Never waste cycles on trivial acknowledgments

First, silently review:
- Your Observational Memory (the log of 🔴🟡⚪ entries)
- All active plans and their current status
- The calendar for upcoming commitments
- What you accomplished in the last few cycles
- What is still blocked or forgotten

Then decide what will create the most value in the next cycle.

You may take any of these actions (you are encouraged to be decisive):

- "review_and_plan"      → Launch the full planning + execution graph cycle with clear instructions
- "work_on_memory_article" → Create or update a knowledge base article (great for documenting lessons or research)
- "use_tools"            → Directly call one or more tools right now (calendar, n8n, search, etc.)
- "continue"             → Keep thinking / running another cycle (only if you have real work)
- "end"                  → Go back to sleep (only when everything important is handled)

You are allowed and encouraged to:
- Create new plans from scratch
- Update or delete old plans
- Schedule things on the calendar
- Document important realizations in the knowledge base
- Call multiple tools in one cycle
- Be opinionated about what deserves attention

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "thinking": "One or two sentences of your internal reasoning. Be honest and strategic.",
  "emit_chat_message": "Optional short message (only if you want the user to see something)",
  "action": "review_and_plan" | "work_on_memory_article" | "use_tools" | "continue" | "end" | "direct_answer" | "ask_clarification",  // default is "run_again"
  "instructions_prompt": "Detailed instructions for the chosen action (especially important for trigger_* actions)",
  ${TOOLS_RESPONSE_JSON}
}`;

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
 *   - state.metadata.subGraph exists (OverlordThreadState shape)
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
      includeTools: false,
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
      return { state, decision: { type: 'continue' } };
    }

    const data = llmResponse as { action: string; reason?: string };
    const action = data.action;

    if (llmResponse.action === 'use_tools') {
      const data = llmResponse as { tools: any[]; markDone: boolean };
      const tools = Array.isArray(data.tools) ? data.tools : [];

      // Execute tools if instructed
      if (tools.length > 0) {
        await this.executeToolCalls(state, tools);
      }
    }
    
    if (llmResponse.emit_chat_message?.trim()) {
      await this.executeSingleTool(state, ["emit_chat_message", llmResponse.emit_chat_message]);
    }

    if (llmResponse.action === 'direct_answer' || llmResponse.action === 'ask_clarification') {
      return { state, decision: { type: 'end' } };
    }

    if (!llmResponse.action) {
      return { state, decision: { type: 'end' } };
    }
    
    // Chosen decisions
    if (action === 'review_and_plan') {
      state.metadata.subGraph = {
        state: 'trigger_subgraph',
        name: 'hierarchical',
        prompt: data.reason?.trim() || "OverLord initiating planning cycle",
        response: ''
      };

      return { state, decision: { type: 'next' } };

    } else if (action === 'work_on_memory_article') {
      state.metadata.subGraph = {
        state: 'trigger_subgraph',
        name: 'knowledge',
        prompt: data.reason?.trim() || "OverLord initiating knowledge base cycle",
        response: ''
      };

      return { state, decision: { type: 'next' } };
    }

    // Default: continue loop
    return { state, decision: { type: 'continue' } };
  }
}