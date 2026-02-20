// SkillCriticNode.ts
// Reviews ReAct loop progress and decides: continue / revise / complete
// Specifically designed for SkillGraph with BaseThreadState
// Evaluates reasoning-action cycles and skill progress

import type { BaseThreadState, NodeResult } from './Graph';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';

const SKILL_CRITIC_PROMPT = `You are the Critic Agent. Sole job: validate completion of the project documents.

**Inputs every cycle:**
- Full Project Resource Document (PRD) The PRD is the primary source of truth for this project and includes the project context.
- Current Technical Execution Brief (TPRD) The last task that was worked on.
- Statement from the Executor 
- Previous cycle history

**Rules (never break):**
- You will know if the technical resource document is completed if you can point to factual proof that it has met it's goal.
- If the technical resource document is not completed then you need to give a complete explanation of why and what you need to see in order for it to be done.
- You will know if the project is completed if the technical document has been completed and it;s completion proves we have met the ultimate goal of the PRD.
- If the prd is not completed then we need a full reason as to why and what you need to see to confirm its completion.

Here's the full project resource document (PRD) this is the primary source of truth for the project we're currently working on and includes the full project context.
---
## Planning Instructions (PRD)
{{planning_instructions}}
---

Now I'm gonna give you the technicalinstructions were a planner has decided what steps to work on.
An executor has received this document and attempted to complete the steps inside.
---
## Technical Instructions (TPRD)
{{technical_instructions}}
---

Now you have in the message history all of the steps taken by the executor in order to attempt to complete the technical instructions.
I want you to review the work that's been done against the technical instructions having the full project context you need to determine if this technical resource document and the steps inside it has been completed satisfactorally.
It's likely that you will need to disregard much of what the executor says they have done and look to see what they actually have done from the tool calls to find factual evidence that this technical resource has been completed satisfactorally.

Now compare the technical instructions against the planning instructions and determine if the planning instructions within the project resource document still requires some work or if they are now fully completed.
One important exclusion: if you have done all of the work you can do and you are blocked buy something you're unable to figure out yourself and you require your humans assistance, such as the case for tools fundamentally breaking or missing credentials

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "technical_completed": boolean,
  "technical_feedback": "string — thorough factual explanation. If false, list missing proof/items with exact quotes from Executor output. If true, confirm what was delivered.",
  "project_complete": boolean,
  "project_feedback": "string — does this complete a Must-Have in PRD? If false, list remaining open items from PRD with exact section references."
}`.trim();

/**
 * Skill Critic Node
 *
 * Purpose:
 *   - Evaluates ReAct loop progress (reasoning + action cycles)
 *   - Decides whether to continue loop, revise approach, or complete task
 *   - Considers skill template compliance and evidence quality
 *   - Prevents infinite loops by evaluating progress after X cycles
 *
 * Key Features:
 *   - Works with BaseThreadState (compatible with SkillGraph)
 *   - Analyzes reasoning-action cycle effectiveness
 *   - Evaluates evidence collection quality
 *   - Makes routing decisions for graph flow
 *   - Skill-aware evaluation against templates
 *
 * Input expectations:
 *   - state.metadata.reasoning (ReasoningNode results)
 *   - state.metadata.actions (ActionNode results with evidence)
 *   - state.metadata.planner (goal and skill info)
 *   - Multiple ReAct cycles have occurred
 *
 * Output mutations:
 *   - state.metadata.skillCritic = { decision, reason, progressScore, evidenceScore }
 *   - Routes to: reasoning (continue), planner (revise), or summary (complete)
 *
 * @extends BaseNode
 */
export class SkillCriticNode extends BaseNode {
  constructor() {
    super('skill_critic', 'Skill Critic');
  }

  async execute(state: BaseThreadState): Promise<NodeResult<BaseThreadState>> {
    const prompt = this.buildCriticPrompt(state);

    const enriched = await this.enrichPrompt(prompt, state, {
      includeSoul: false,
      includeAwareness: false,
      includeMemory: false
    });

    const llmResponse = await this.chat(state, enriched, {
      format: 'json',
      disableTools: true,
      temperature: 0,
      maxTokens: 4096,
    });

    if (!llmResponse) {
      (state.metadata as any).skillCritic = {
        technical_completed: false,
        technical_feedback: 'Critic model returned no response. Technical completion cannot be validated.',
        project_complete: false,
        project_feedback: 'Project completion cannot be validated until technical completion is confirmed.',
        evaluatedAt: Date.now(),
      };
      return { state, decision: { type: 'next' } };
    }

    const data = (typeof llmResponse === 'string'
      ? this.parseJson(llmResponse)
      : llmResponse) as {
      technical_completed?: boolean;
      technical_feedback?: string;
      project_complete?: boolean;
      project_feedback?: string;
    } | null;

    if (!data || typeof data !== 'object') {
      (state.metadata as any).skillCritic = {
        technical_completed: false,
        technical_feedback: 'Critic response was not valid JSON. Technical completion cannot be validated.',
        project_complete: false,
        project_feedback: 'Project completion cannot be validated until technical completion is confirmed.',
        evaluatedAt: Date.now(),
      };
      return { state, decision: { type: 'next' } };
    }

    const technicalCompleted = data.technical_completed === true;
    const projectComplete = technicalCompleted && data.project_complete === true;

    (state.metadata as any).skillCritic = {
      technical_completed: technicalCompleted,
      technical_feedback: (data.technical_feedback || '').trim(),
      project_complete: projectComplete,
      project_feedback: (data.project_feedback || '').trim(),
      evaluatedAt: Date.now(),
    };

    console.log(`[SkillCritic] technical_completed=${technicalCompleted} project_complete=${projectComplete}`);

    return { state, decision: { type: 'next' } };
  }

  private buildCriticPrompt(state: BaseThreadState): string {
    const planningInstructions = (state.metadata as any).planning_instructions || 'No planning instructions available.';
    const technicalInstructions = (state.metadata as any).technical_instructions || 'No technical instructions available.';

    return SKILL_CRITIC_PROMPT
      .replace('{{planning_instructions}}', planningInstructions)
      .replace('{{technical_instructions}}', technicalInstructions);
  }
}
