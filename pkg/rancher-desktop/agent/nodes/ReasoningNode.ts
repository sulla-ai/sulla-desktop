import { BaseNode } from './BaseNode';
import type { BaseThreadState, NodeResult } from './Graph';
import { ActivePlanManager } from './ActivePlanManager';

// ============================================================================
// REASONING PROMPT
//
// The PRD (stored at state.metadata.planning_instructions) is injected as
// the system prompt. This prompt adds the ReAct reasoning layer on top of it.
//
// ReasoningNode's job:
//   1. Review the PRD checklist and action results so far
//   2. Update the checklist (mark items done, add notes)
//   3. Determine if the goal is complete
//   4. Write a focus_instruction that tells ActionNode exactly what to do next
// ============================================================================

const REASONING_PROMPT_SUFFIX = ` you are a specialized technical project management system. 
Your job is to design a clean, professional, production-grade technical solution from the non-technical PRD.

You're back in system that does not communicate with users, you only communicate with other agents by producing a technical resource document they can use to complete the task.

You will receive:
- a Technical PRD Starter Template (TPRD)
- Full current non-technical Project Resource Document (PRD) (never change it)
- Results from last Action cycle

Rules:
- You are to prepare instructions for the Executor Agent with context and direction
- Pick one clear action step the executor needs to take to move this project from where it is towards the goal
- Build a Technical PRD (TPRD) for the next action steps as we work on completing a chunk of the PRD
- Think like a senior engineer: first-principles, modularity, scalability, error handling, state management, separation of concerns.
- Design the right way, not the quick way.
- Output ONLY the block below — no intro, no commentary.

### Technical PRD Quick Starter Template
\`\`\`
---
slug: your-tprd-slug-goes-here
title: "the actin step name goes here"
section: Projects
category: "The category this would fall under goes here"
tags:
  - skill
mentions:
  - slugs-to-mentioned-entity-docs
related_entities:
   - slugs-to-related-entities
---

# Technical Execution Brief

**Current FOCUS**  
[paste exact FOCUS]

**Success Criteria This Cycle**  
[1-2 sentences: measurable technical outcome]

**Architectural Design**  
High-level structure + key decisions (modules, data flow, state, error strategy).

**Execution Steps**  
1. Concrete first step  
2. Concrete second step  
...

**Tools & Commands**  
- exact tool + params

**Risks & Mitigations**  
- risk → fix

**Immediate Next Action for Action Node**  
[one crystal-clear sentence]
\`\`\`

Keep it dense, senior-level, and ready for long-running execution.

## The Project PRD

\`\`\`
{{planning_instructions}}
\`\`\`


## Previous Action Results

\`\`\`
{{previous_action_result}}
\`\`\`

## Critic Technical Feedback (if provided)

\`\`\`
{{critic_feedback}}
\`\`\`

## Instructions
You are a senior solutions architect with 25+ years building production systems. Your job is to design a clean, professional, production-grade technical solution from the non-technical PRD.

You've received:
- Technical PRD Template
- Full current Project Resource Document (never change it)
- Results from last Action cycle

Rules:
- You are to prepare instructions for the Executor Agent
- Pick one clear action step the executor needs to take to move this project from where it is towards the goal
- Think like a senior engineer: first-principles, modularity, scalability, error handling, state management, separation of concerns.
- Design the right way, not the quick way.
- Output ONLY the block below — no intro, no commentary.
- Produce a clean, technical-level document the ActionNode will follow.
- Research first if needed.
- When ready, output ONLY the Technical PRD block below — nothing else, no commentary, no tool calls after research.
`;

// ============================================================================
// REASONING NODE
// ============================================================================

/**
 * Reasoning Node - ReAct Loop Component
 *
 * Purpose:
 *   - Reads the PRD from state.metadata.planning_instructions as its system prompt
 *   - Writes a technical instruction document to state.metadata.technical_instructions
 *   - Produces one technical instruction document per cycle
 *
 * Design:
 *   - PRD is the system prompt — no raw skill data injection needed
 *   - technical_instruction is produced each cycle for downstream execution
 */
export class ReasoningNode extends BaseNode {
  constructor() {
    super('reasoning', 'Reasoning');
  }

  async execute(state: BaseThreadState): Promise<NodeResult<BaseThreadState>> {
    // Clear previous technical instructions so routing only proceeds on fresh output.
    delete (state.metadata as any).technical_instructions;

    // ----------------------------------------------------------------
    // 0. HEARTBEAT
    // ----------------------------------------------------------------
    await this.checkActivePlanAndSendHeartbeat(state);

    // ----------------------------------------------------------------
    // 2. BUILD SYSTEM PROMPT = PRD + REASONING SUFFIX
    // ----------------------------------------------------------------
    const systemPrompt = this.addReasoningContext(state, REASONING_PROMPT_SUFFIX);

    const enrichedPrompt = await this.enrichPrompt(systemPrompt, state, {
      includeSoul: false,
      includeAwareness: true,
      includeMemory: false
    });

    const technicalInstructions = await this.generateTechnicalInstructions(state, enrichedPrompt);
    if (technicalInstructions) {
      (state.metadata as any).technical_instructions = technicalInstructions;
      (state.metadata as any).reasoning = {
        ...((state.metadata as any).reasoning || {}),
        timestamp: Date.now(),
      };

      const parsedTprd = this.extractTprdFrontmatter(technicalInstructions, state);
      if (parsedTprd) {
        (state.metadata as any).reasoning = {
          ...((state.metadata as any).reasoning || {}),
          tprd_slug: parsedTprd.meta.slug,
        };
      }

      console.log(`[ReasoningNode] technical_instructions stored (${technicalInstructions.length} chars)`);
    }

    // ----------------------------------------------------------------
    // 4. LOG
    // ----------------------------------------------------------------
    const hasTechnicalInstructions = !!(state.metadata as any).technical_instructions;
    console.log(`[ReasoningNode] Status: ${hasTechnicalInstructions ? 'READY' : 'RETRYING'}`);

    return { state, decision: { type: 'next' } };
  }

  // ======================================================================
  // REASONING AND DECISION MAKING
  // ======================================================================

  /**
   * 
   * @param state 
   * @param basePrompt 
   * @returns 
   */
  private addReasoningContext(state: BaseThreadState, basePrompt: string): string {
    const prd = (state.metadata as any).planning_instructions;
    const previousActionResult = this.getPreviousActionResult(state);
    const criticFeedback = (state.metadata as any).reasoning?.critic_feedback || 'No critic technical feedback provided.';

    return basePrompt
      .replace('{{planning_instructions}}', prd || '')
      .replace('{{previous_action_result}}', previousActionResult)
      .replace('{{critic_feedback}}', criticFeedback);
  }

  /**
   * 
   * @param state 
   * @param systemPrompt 
   * @returns 
   */
  private async generateTechnicalInstructions(state: BaseThreadState, systemPrompt: string): Promise<string | null> {
    const content = await this.chat(state, systemPrompt, {
      disableTools: true,
      temperature: 0.2,
      maxTokens: 4096,
    });

    if (!content) {
      console.warn('[ReasoningNode] LLM returned empty technical instructions');
      return null;
    }

    return typeof content === 'string' ? content.trim() : String(content).trim();
  }

  private extractTprdFrontmatter(
    tprd: string,
    state: BaseThreadState,
  ): { meta: Record<string, any>; document: string } | null {
    const fallbackSlugSource = `${(state.metadata as any).planner?.prd_slug || (state.metadata as any).planRetrieval?.goal || 'technical-execution-brief'}-tprd`;
    return this.prepareArticleFromStructuredOutput(tprd, {
      fallbackSlugSource,
      fallbackTitle: 'Technical Execution Brief',
      fallbackHeader: 'Technical Execution Brief',
      defaultSection: 'Projects',
      defaultCategory: 'Projects',
      defaultTags: ['skill'],
    });
  }

  // ======================================================================
  // ACTIVE PLAN HEARTBEAT
  // ======================================================================

  private async checkActivePlanAndSendHeartbeat(state: BaseThreadState): Promise<void> {
    try {
      const threadId = state.metadata.threadId;
      const activePlanManager = ActivePlanManager.getInstance();
      const activePlans = await activePlanManager.getActivePlans(threadId);

      if (activePlans.length > 0) {
        const currentPlan = activePlans[0];
        const executorPID = process.pid.toString();
        await activePlanManager.sendHeartbeat(threadId, currentPlan.planId, executorPID);

        console.log(`[ReasoningNode] Heartbeat sent for plan: ${currentPlan.planId} (${currentPlan.skillTitle || 'General'})`);

        (state.metadata as any).reasoning = {
          ...((state.metadata as any).reasoning || {}),
          activePlanId: currentPlan.planId,
          activePlanStatus: currentPlan.status,
          activePlanSkill: currentPlan.skillSlug,
        };
      } else {
        console.log('[ReasoningNode] No active plans found for this thread');
      }
    } catch (error) {
      console.warn('[ReasoningNode] Error sending heartbeat:', error);
    }
  }

  // ======================================================================
  // HELPERS
  // ======================================================================

  private getPreviousActionResult(state: BaseThreadState): string {
    const actions = (state.metadata as any).actions || [];
    if (actions.length === 0) return 'No previous actions taken yet.';

    const lastAction = actions[actions.length - 1];
    const status = lastAction.success ? 'SUCCESS' : 'FAILED';
    const result = typeof lastAction.result === 'string'
      ? lastAction.result.substring(0, 500)
      : JSON.stringify(lastAction.result || '').substring(0, 500);

    return `Last action [${status}]: ${lastAction.action_type || 'unknown'}\nResult: ${result}`;
  }
}
