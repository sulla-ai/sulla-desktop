import { BaseNode } from './BaseNode';
import { BaseThreadState, NodeResult } from './Graph';

// ============================================================================
// PRD PROMPT
//
// The Planner's only job is to produce a rich, personalized PRD that will be
// used as the system prompt for every ReasoningNode and ActionNode cycle.
//
// The LLM has full tool access here — it should research the environment,
// pull relevant documents, inspect files, and iterate until the PRD is
// complete and accurate for *this* user and *this* system.
//
// Required sections are listed below. The LLM has freedom in the content
// of each section but must include all of them.
// ============================================================================

const PRD_PROMPT = `You are the Project Manager + Solutions Architect. Your sole responsibility is to own and maintain the single source of truth: a living, non-technical Project Resource Document (PRD).

User intent: {{intent}}
Goal: {{goal}}

## Critic Project Feedback (if provided)
{{critic_project_feedback}}

## Latest Technical Execution Brief (if provided)
{{critic_tprd}}

## Rules (never break)
- This PRD is the master document. Only you (Planner) may ever modify or extend it.
- Produce a clean, product-level, non-technical document the entire graph will follow.
- Research first if needed.
- When ready, output ONLY the PRD block below — nothing else, no commentary, no tool calls after research.
- Critic may kick revisions back to you. When it does, incorporate changes and re-issue the updated full PRD.
- The only response you are to provide is the PRD
- the markdown header in this PRD template must be followed

### PRD Quick Start Template
\`\`\`
---
slug: your-prd-slug-goes-here
title: "the project title goes here"
section: Projects
category: "The category this would fall under goes here"
tags:
  - skill
  - n8n
mentions:
  - slugs-to-mentioned-entity-docs
related_entities:
   - slugs-to-related-entities
---

# Project Resource Document (Source of Truth)

**Goal**: [One-sentence restatement]

**Status**: In Progress | Under Review | Complete

## 1. Objective
What success looks like for the user (measurable, non-technical).

## 2. Must-Haves
Non-negotiable outcomes.

## 3. Nice-to-Haves
Optional value adds.

## 4. Environment & Resources
Relevant tools, constraints, user preferences.

## 5. High-Level Process
Product steps only (no code, no architecture details — leave that to Reasoning node).

## 6. Checklist
- [ ] Actionable item
- [ ] ...

## 7. Notes & Revision History
Decisions, risks, previous critic feedback, your updates.

\`\`\`

You may add/remove/rename sections for clarity on this specific task. Keep it concise and human-readable. This document lives forever and is the only source of truth.

CRITICAL OUTPUT RULE: After any tools, the very next message you send must be ONLY the PRD block above. Nothing else.
`;

// ============================================================================
// PLANNER NODE
// ============================================================================

/**
 * Planner Node
 *
 * Purpose:
 *   - Produce a personalized PRD working document from goal + SOP skill
 *   - Research the environment using tools before writing the PRD
 *   - Store the completed PRD at state.metadata.planning_instructions
 *
 * Design:
 *   - Tools enabled — Planner actively researches context before writing
 *   - Tool calls happen inline within this.chat() via BaseNode
 *   - PRD stored at state.metadata.planning_instructions (single write, read-only for others)
 *   - No responseImmediate logic — Planner always produces a PRD
 */
export class PlannerNode extends BaseNode {
  constructor() {
    super('planner', 'Planner');
  }

  async execute(state: BaseThreadState): Promise<NodeResult<BaseThreadState>> {
    let prompt = PRD_PROMPT;

    // ----------------------------------------------------------------
    // 1. EXTRACT GOAL AND SKILL CONTEXT FROM STATE
    // ----------------------------------------------------------------
    prompt = this.addPlanningContext(state, prompt);

    // ----------------------------------------------------------------
    // 2. GENERATE PRD — LLM is the only author
    //    Tools are enabled — the LLM researches the environment first,
    //    then outputs the PRD and nothing else.
    // ----------------------------------------------------------------
    const prd = await this.generatePrd(state, prompt);

    if (prd) {
      this.storePrd(state, prd);
    } else {
      // LLM failed — leave planning_instructions unset so Graph retry logic triggers
      (state.metadata as any).planner = {
        ...((state.metadata as any).planner || {}),
        prd_generated: false,
      };
      console.warn('[PlannerNode] PRD generation failed — graph will retry');
    }

    return {
      state,
      decision: { type: 'next' },
    };
  }

  // ======================================================================
  // CONTEXT EXTRACTION
  // ======================================================================

  private addPlanningContext(
    state: BaseThreadState,
    basePrompt: string,
  ): string {
    const planRetrieval = (state.metadata as any).planRetrieval || {};

    const goal =
      planRetrieval.goal ||
      planRetrieval.intent ||
      'Complete the requested task';
    const intent = planRetrieval.intent || '';

    const plannerMeta = (state.metadata as any).planner || {};
    const criticProjectFeedback = plannerMeta.critic_feedback || 'No critic project feedback provided.';
    const criticTprd = plannerMeta.critic_tprd || 'No technical execution brief provided.';

    const prompt = basePrompt
      .replace('{{goal}}', goal)
      .replace('{{intent}}', intent)
      .replace('{{critic_project_feedback}}', criticProjectFeedback)
      .replace('{{critic_tprd}}', criticTprd);

    console.log(`[PlannerNode] Goal: "${goal}"`);

    return prompt;
  }

  // ======================================================================
  // PRD GENERATION
  // ======================================================================

  private async generatePrd(
    state: BaseThreadState,
    prompt: string,
  ): Promise<string | null> {

    const enrichedPrompt = await this.enrichPrompt(prompt, state, {
      includeSoul: false,
      includeAwareness: true,
      includeMemory: false
    });

    console.log('[PlannerNode] Generating PRD');

    // Tools are intentionally ENABLED — the LLM researches the environment
    // then produces the PRD as its final response when done with tool calls.
    const content = await this.chat(state, enrichedPrompt, {
      temperature: 0.3,
      maxTokens: 4096,
    });

    if (!content) {
      console.warn('[PlannerNode] LLM returned no content for PRD');
      return null;
    }

    const contentStr = typeof content === 'string' ? content : String(content);

    console.log(`[PlannerNode] PRD generated: ${contentStr.length} chars`);
    return contentStr;
  }

  // ======================================================================
  // PRD STORAGE
  // ======================================================================

  private storePrd(
    state: BaseThreadState,
    prd: string
  ): void {
    // Store the PRD as planning_instructions — the single source of truth
    // consumed by ReasoningNode and ActionNode as their system prompt base
    (state.metadata as any).planning_instructions = prd;

    // Store planner metadata for routing and diagnostics
    (state.metadata as any).planner = {
      ...((state.metadata as any).planner || {}),
      prd_generated: true
    };

    const parsedPrd = this.extractPrdFrontmatter(prd, state);
    if (parsedPrd) {
      (state.metadata as any).planner = {
        ...((state.metadata as any).planner || {}),
        prd_slug: parsedPrd.meta.slug,
      };

      void this.savePrdArticleAsync(parsedPrd.meta, parsedPrd.document);
    }

    console.log(`[PlannerNode] PRD stored at planning_instructions (${prd.length} chars)`);
  }

  private extractPrdFrontmatter(
    prd: string,
    state: BaseThreadState,
  ): { meta: Record<string, any>; document: string } | null {
    const goal = (state.metadata as any).planRetrieval?.goal || 'project-resource-document';
    return this.prepareArticleFromStructuredOutput(prd, {
      fallbackSlugSource: goal,
      fallbackTitle: goal,
      fallbackHeader: 'Project Resource Document',
      defaultSection: 'Projects',
      defaultCategory: 'Projects',
      defaultTags: ['skill'],
    });
  }

  private async savePrdArticleAsync(meta: Record<string, any>, document: string): Promise<void> {
    await this.saveArticleAsync(meta, document, 'PlannerNode');
  }
}
