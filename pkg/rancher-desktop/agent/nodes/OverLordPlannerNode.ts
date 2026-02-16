// OverLordPlannerNode.ts
// Autonomous high-level oversight during heartbeat/idle periods
// Decides: trigger hierarchical graph, continue looping, or end

import type { OverlordThreadState, NodeResult } from './Graph';
import { BaseNode,JSON_ONLY_RESPONSE_INSTRUCTIONS, TOOLS_RESPONSE_JSON } from './BaseNode';
import { SullaSettingsModel } from '../database/models/SullaSettingsModel';
import { heartbeatPrompt } from '../prompts/heartbeat';

const OVERLORD_DECISION_PROMPT = `
Once you decide on something to do you should create a product resource document in memory (neo4j) which will act as the source of truth for the project.
you should make an observational note about the document slug/id so you can remember what you're working on

## Tools 

### Taking action
You have a dedicated tool: trigger_subgraph.

Use it to hand off any non-trivial execution. It launches a full hierarchical decision graph that thinks step-by-step, uses tools, spawns sub-agents, and runs the entire plan to completion.

You only receive a clean one-paragraph summary back — no thread clutter, no micro steps.

This is how you stay high-level: your job is to spot the highest-leverage plan, then immediately trigger_subgraph tool with a precise payload. Let the graph own the details and delivery. You stay in the cockpit, not in the engine room.

### Setting up workflows
You should manage automations/workflows/recurring tasks and the best way to do that is with n8n which is launched as a docker container and it's yours to manage.

You can access the n8n tools list by calling the 'browse_tools' function and searching for the 'n8n' category to get all n8n functions.

- Some tasks your human might want to do multiple times, so you can set up workflows to make it easier for them.
- use the n8n tools to create and manage workflows as this will create some of the most value

- if the n8n tools are giving you difficulty:
  - you can access the n8n db with the pg tools. pg -U sulla -d sulla
  - you can also use the docker tools to gain access to the n8n container

- To use n8n efficiently you should start by finding a template that could solve most of the requirements.
`;

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
      return { state, decision: { type: 'continue' } };
    }
    
    if (llmResponse.emit_chat_message?.trim()) {
      await this.wsChatMessage(state, llmResponse.emit_chat_message, 'assistant');
    }

    if (llmResponse.action === 'direct_answer' || llmResponse.action === 'ask_clarification') {
      return { state, decision: { type: 'end' } };
    }

    if (!llmResponse.action) {
      return { state, decision: { type: 'end' } };
    }
    
    // Chosen decisions
    if (llmResponse.metadata.action === 'review_and_plan') {
      state.metadata.subGraph = {
        state: 'trigger_subgraph',
        name: 'hierarchical',
        prompt: llmResponse.metadata.reasoning?.trim() || "OverLord initiating planning cycle",
        response: ''
      };

      return { state, decision: { type: 'next' } };

    } else if (llmResponse.metadata.action === 'work_on_memory_article') {
      state.metadata.subGraph = {
        state: 'trigger_subgraph',
        name: 'knowledge',
        prompt: llmResponse.metadata.reasoning?.trim() || "OverLord initiating knowledge base cycle",
        response: ''
      };

      return { state, decision: { type: 'next' } };
    }

    // Default: continue loop
    return { state, decision: { type: 'continue' } };
  }
}