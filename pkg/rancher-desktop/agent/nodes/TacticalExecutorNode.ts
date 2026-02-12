// TacticalExecutorNode.ts
// Executes current tactical step: decides tools, runs them, updates step/milestone status
// Only runs when currentSteps + activeStepIndex exist (guaranteed by graph flow)

import type { HierarchicalThreadState, NodeResult } from './Graph';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { AgentPlanTodo } from '../database/models/AgentPlanTodo';

const TACTICAL_EXECUTOR_PROMPT = `
You are the Tactical Executor — a highly resourceful, relentless, and self-improving senior engineer living inside the user's primary desktop machine.

Current tactical step:
{{step.action}} — {{step.description}}

Milestone context: {{milestone.title}} — {{milestone.description}}
Success criteria: {{milestone.successCriteria}}

Overall goal: {{goal}}

After every attempt, reflect honestly:
- What worked?
- What failed and why?
- What will I do differently next time?

After completing the current tactical step, if you believe this step is fully done and no further tool use is required:

- Set "tools": []
- Set "markDone": true
- Do NOT call any tools, including emit

// when step is complete 
{
  "tools": [],
  "markDone": true
}
// when you want to notify but still end
{
  "tools": [["emit_chat_message", "Task finished, moving to next milestone"]],
  "markDone": true
} 
// when more work is needed, choose and chain the tools/actions you want to take
{
  "tools": [
    ["some_real_tool", "arg"],
    ["some_other_tool", "arg2", "arg3"],
    ["emit_chat_message", "User update"]
  ],
  "markDone": false
}

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "tools": [
    ["tool_name", "arg1", "arg2"],
    ["emit_chat_message", "User update"]
  ],
  "markDone": true | false
}
`.trim();

/**
 * Tactical Executor Node
 *
 * Purpose:
 *   - Executes current tactical step via LLM tool decisions
 *   - Runs tools, appends results to messages
 *   - Updates step done status
 *   - Advances active step index or marks milestone complete
 *
 * Key Design Decisions (2025 refactor):
 *   - No no-plan fallback — assumes currentSteps + activeStepIndex exist
 *   - Unified BaseNode.chat() + executeToolCalls()
 *   - Direct .content object access (parsed JSON)
 *   - Neutral decision — graph edges route to critic / next step
 *   - WS feedback only on step completion / failure
 *   - Updates AgentPlanTodo in DB on step/milestone done
 *
 * Input expectations:
 *   - state.metadata.currentSteps exists & non-empty
 *   - state.metadata.activeStepIndex valid
 *   - HierarchicalThreadState shape
 *
 * Output mutations:
 *   - state.metadata.currentSteps[i].done = true when finished
 *   - state.metadata.activeStepIndex++ or cleared on milestone done
 *   - DB: AgentPlanTodo status updated
 *
 * @extends BaseNode
 */
export class TacticalExecutorNode extends BaseNode {
  constructor() {
    super('tactical_executor', 'Tactical Executor');
  }

  async execute(state: HierarchicalThreadState): Promise<NodeResult<HierarchicalThreadState>> {

    // Establish WebSocket connection using the dynamic channel from state
    const connectionId = state.metadata.wsChannel as string;
    if (connectionId && !this.isWebSocketConnected(connectionId)) {
      this.connectWebSocket(connectionId);
    }

    const plan = state.metadata.plan;
    const steps = state.metadata.currentSteps ?? [];
    const stepIdx = state.metadata.activeStepIndex ?? 0;

    if (stepIdx >= steps.length || !steps[stepIdx]) {
      console.log('[TacticalExecutor] Invalid step index — skipping');
      return { state, decision: { type: 'next' } };
    }

    const step = steps[stepIdx];
    const milestoneIdx = plan?.activeMilestoneIndex ?? 0;
    const currentTodo = plan?.milestones?.[milestoneIdx]?.model as AgentPlanTodo | undefined;

    // Build prompt with current step context
    const prompt = TACTICAL_EXECUTOR_PROMPT;

    const enriched = await this.enrichPrompt(prompt, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: true,
      includeTools: true,
      includeStrategicPlan: true,
      includeTacticalPlan: true,
      includeKnowledgebasePlan: false,
    });

    const llmResponse = await this.chat(state, enriched, { format: 'json' });
    if (!llmResponse) {
      return { state, decision: { type: 'next' } };
    }

    const data = llmResponse as { tools: any[]; markDone: boolean };
    const tools = Array.isArray(data.tools) ? data.tools : [];

    // Execute tools if instructed
    if (tools.length > 0) {
      await this.executeToolCalls(state, tools);
    }

    // Update step status only — no routing
    if (data.markDone === true) {
      step.done = true;
      step.resultSummary = 'Step completed successfully'; // or parse from last tool result

      if (currentTodo) {
        currentTodo.markStatus('done');
        await currentTodo.save();
        console.log('[TacticalExecutor] Milestone todo marked done');
      }

      // Advance index if more steps exist
      if (stepIdx + 1 < steps.length) {
        state.metadata.activeStepIndex = stepIdx + 1;
      } else {
        // All steps done for this milestone
        state.metadata.currentSteps = [];
        state.metadata.activeStepIndex = 0;
        if (plan) {
          plan.activeMilestoneIndex = milestoneIdx + 1;
          plan.allMilestonesComplete = plan.activeMilestoneIndex >= (plan.milestones?.length ?? 0);
        }
      }
    }

    // Always next — graph decides if more work or critic/summary
    return { state, decision: { type: 'next' } };
  }
}