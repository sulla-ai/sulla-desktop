import { BaseNode } from './BaseNode';
import type { NodeRunPolicy } from './BaseNode';
import type { BaseThreadState, NodeResult } from './Graph';
import type { ChatMessage } from '../languagemodels/BaseLanguageModel';
import { toolRegistry } from '../tools/registry';

// ============================================================================
// MACRO NODE PROMPT
//
// The MacroNode is a Project Manager + Solutions Architect.
// It produces a full markdown PRD that thinks through the entire project
// from start to finish, and a single concrete next step for the agent.
//
// Tools are enabled — the LLM should research the environment, pull
// relevant documents, inspect files, and iterate until the PRD is
// complete and accurate.
// ============================================================================

const MACRO_PROMPT = `Your job right now is Project Manager + Solutions Architect.
You own the Project Resource Document (PRD) for this project. Your responsibilities:
1. On the FIRST cycle: create a full PRD from the user's goal.
2. On EVERY subsequent cycle: monitor progress, evaluate what the agent accomplished,
   and decide whether the PRD needs revision or is still on track.
3. Always produce a single concrete next step for the agent to execute.
4. Decide whether this project should SKIP PRD entirely (too small/simple), remain in DRAFT, or mark PRD FINAL.

## Monitoring Rules (highest priority)

- You are a MONITOR first, an author second.
- If the existing PRD is still valid and the plan is on track, output the existing PRD UNCHANGED inside <MACRO_PRD> and just produce the next step.
- Only revise the PRD when evidence shows the current approach is failing, blocked, or needs adjustment.
- Check off completed execution steps in the PRD when the agent has finished them.
- Update the "What Has Been Tried" section with outcomes from each attempt.

## Progress Communication Rules (strict)

- While working, you MUST communicate your progress in clear, deterministic language.
- Every loop you MUST explicitly state:
  • What you have just done
  • What you plan to do next
  • Any blockers or decisions
- Use short, direct sentences.
- However, when the entire task is finished you MUST stop all explanation and output ONLY the final wrapper blocks with nothing after them.

## Tool Call Strategy (strict - highest priority)

- In your VERY FIRST response you MUST make ONE single large parallel batch containing EVERY tool call you believe is needed to achieve complete understanding and create the full PRD.
- You are allowed and encouraged to call up to 50 tools in parallel in that first batch.
- Do NOT make small incremental calls (no 1-2 tools at a time).
- Critical: As soon as you've got everything you need from the context, stop and create the PRD. Time is of the essence.

## PRD Rules (must follow)

- Think through the ENTIRE project from start to finish.
- First evaluate project size and complexity. If the project is too small/simple to justify a PRD, you must SKIP.
- The PRD must be a full, rich markdown document — not a skeleton or outline.
- Use YAML frontmatter with: schemaversion, slug, title, section, category, tags, order, locked, author, created_at, updated_at, mentions, related_entities.
- Required sections: Project Goal, User Stories, MoSCoW Priorities (Must/Should/Nice-to-Have), Requirements, Credential Resolution, Workflow/Architecture Details, Blockers, Execution Steps.
- The Execution Steps section must be a checklist (- [ ] / - [x]) that the agent works through incrementally.
- **Always start with the simplest viable approach.** Only add complexity when simpler attempts have failed or are proven insufficient.
- If a previous PRD exists, evaluate what has been tried. If the current approach is failing, pivot. If it's working, continue and refine. Don't rewrite from scratch unless the approach fundamentally changes.
- The PRD is a living document — update it every cycle based on evidence.

## Attempt History Evaluation

When attempt history is provided:
- Identify what worked and what didn't.
- If something failed, explain why briefly and adjust the approach in the PRD.
- If the same step has failed multiple times, escalate complexity or try a fundamentally different approach.
- Always prefer the least complex solution that could work.

## Next Step Rules

- Produce exactly ONE concrete, immediately actionable next step.
- It must be specific enough that an agent can execute it without interpretation.
- Never repeat a step that has already been attempted.
- The next step should be the single most impactful thing to do right now.
- The next step should correspond to the next unchecked item in the Execution Steps checklist.

## Output Format (strict)

First output a <MACRO_STATUS> block with EXACTLY one of: DRAFT, FINAL, SKIP.
Wrap the finalized PRD in the <MACRO_PRD> block.
Wrap the single next step in the <MACRO_NEXT_STEP> block.
The <MACRO_PRD> block must contain the complete, ready-to-use markdown PRD only.
The <MACRO_NEXT_STEP> block must contain a single actionable instruction only.

- If status is SKIP:
  - <MACRO_PRD> must be empty.
  - <MACRO_NEXT_STEP> must be exactly: SKIP
- If status is DRAFT:
  - <MACRO_PRD> must contain your latest working draft.
  - <MACRO_NEXT_STEP> should contain the next macro drafting action, not an agent execution step.
- If status is FINAL:
  - <MACRO_PRD> must contain the final PRD for execution.
  - <MACRO_NEXT_STEP> must contain exactly one concrete agent execution step.

{{PRD_CONTEXT}}
`;
let cachedExamplePrd: string | null = null;

async function getExamplePrd(): Promise<string> {
  if (cachedExamplePrd !== null) {
    return cachedExamplePrd;
  }

  const { EXAMPLE_PRD } = await import('./templates/examplePrd');
  cachedExamplePrd = EXAMPLE_PRD;
  return EXAMPLE_PRD;
}
// XML extraction patterns
const MACRO_PRD_REGEX = /<MACRO_PRD>([\s\S]*?)<\/MACRO_PRD>/i;
const MACRO_NEXT_STEP_REGEX = /<MACRO_NEXT_STEP>([\s\S]*?)<\/MACRO_NEXT_STEP>/i;
const MACRO_STATUS_REGEX = /<MACRO_STATUS>([\s\S]*?)<\/MACRO_STATUS>/i;
const MAX_MACRO_SELF_LOOPS = 5;
type MacroStatus = 'DRAFT' | 'FINAL' | 'SKIP';

// ============================================================================
// MACRO NODE
// ============================================================================
/**
 * MacroNode — PRD builder and maintainer for AgentGraph
 *
 * Purpose:
 *   - Sits between InputHandler and Agent
 *   - Builds or revises a full markdown PRD thinking through the entire project
 *   - Produces a single next step instruction for the AgentNode
 *   - Stores PRD markdown and next_step on state.metadata.macro
 *
 * Design:
 *   - Tools enabled — MacroNode researches the environment before writing
 *   - Produces full markdown PRD wrapped in <MACRO_PRD> XML
 *   - Produces single next step wrapped in <MACRO_NEXT_STEP> XML
 *   - Reads attempt history from state.metadata.macro.attempts
 *   - Writes PRD + next_step back to state.metadata.macro
 */
export class MacroNode extends BaseNode {
  constructor() {
    super('macro', 'Macro');
  }

  async execute(state: BaseThreadState): Promise<NodeResult<BaseThreadState>> {
    const startTime = Date.now();
    const metadataAny = state.metadata as any;

    // ----------------------------------------------------------------
    // 1. GATHER CONTEXT
    // ----------------------------------------------------------------
    const existingMacro = metadataAny.macro || {};
    const existingPrd = existingMacro.prd || '';
    const attempts: any[] = [...(existingMacro.attempts || [])];
    const agentHistory = metadataAny.agent || {};

    // If agent reported blocked/done last cycle, record it as an attempt
    if (agentHistory.status && agentHistory.status !== 'in_progress') {
      attempts.push({
        status: agentHistory.status,
        summary: agentHistory.blocker_reason || agentHistory.response || 'completed',
        timestamp: agentHistory.updatedAt || Date.now(),
      });
    }

    // Build user directive with all context
    const userGoal = this.getLatestUserInstruction(state);

    // ----------------------------------------------------------------
    // 2. PRELOAD TOOLS
    // ----------------------------------------------------------------
    await this.preloadReadOperationTools(state);

    // ----------------------------------------------------------------
    // 3. CALL LLM (self-loop) — draft until FINAL or SKIP
    // ----------------------------------------------------------------
    const policy: Required<NodeRunPolicy> = {
      messageSource: 'custom',
      persistAssistantToGraph: false,
      persistToolResultsToGraph: false,
      persistAssistantToNodeState: true,
      persistToolResultsToNodeState: true,
      nodeStateNamespace: 'macro',
      includeGraphAssistantMessages: true,
      includeGraphUserMessages: false,
    };

    let workingPrd = existingPrd;
    let nextStep = '';
    let macroStatus: MacroStatus = workingPrd ? 'FINAL' : 'DRAFT';
    let macroCycles = 0;

    while (macroCycles < MAX_MACRO_SELF_LOOPS) {
      macroCycles += 1;

      // Build the prompt with the right PRD context (example vs existing)
      const promptWithPrd = await this.buildPromptWithPrdContext(workingPrd);
      const enrichedPrompt = await this.enrichPrompt(promptWithPrd, state, {
        includeSoul: true,
        includeAwareness: true,
        includeEnvironment: true,
        includeMemory: false,
      });

      const userDirective = `${this.buildUserDirective(userGoal, workingPrd, attempts)}

## Macro Self-Loop Control
Cycle: ${macroCycles}/${MAX_MACRO_SELF_LOOPS}
- Return <MACRO_STATUS>DRAFT</MACRO_STATUS> while still drafting PRD.
- Return <MACRO_STATUS>FINAL</MACRO_STATUS> only when the PRD is complete and execution-ready.
- Return <MACRO_STATUS>SKIP</MACRO_STATUS> when the project is too small/simple and should skip PRD entirely.
`;

      const reply = await this.normalizedChat(state, enrichedPrompt, {
        temperature: 0.3,
        maxTokens: 6144,
        nodeRunPolicy: policy,
        nodeRunMessages: {
          userMessages: [{ role: 'user', content: userDirective } as ChatMessage],
        },
      });

      const contentStr = reply ? (typeof reply.content === 'string' ? reply.content : String(reply.content)) : '';

      // Send any non-wrapper chatter as progress
      const chatter = this.extractNonWrapperChatter(contentStr);
      if (chatter) {
        await this.wsChatMessage(state, chatter, 'assistant', 'progress');
      }

      const extractedPrd = this.extractPrd(contentStr);
      if (extractedPrd) {
        workingPrd = extractedPrd;
      }

      nextStep = this.extractNextStep(contentStr);
      macroStatus = this.extractStatus(contentStr, workingPrd, nextStep);

      if (macroStatus === 'FINAL' || macroStatus === 'SKIP') {
        break;
      }
    }

    // ----------------------------------------------------------------
    // 4. PARSE XML WRAPPERS AND UPDATE STATE
    // ----------------------------------------------------------------
    if (macroStatus === 'DRAFT') {
      // Safety fallback if model never exits draft mode
      macroStatus = workingPrd ? 'FINAL' : 'SKIP';
      if (macroStatus === 'SKIP') {
        nextStep = 'SKIP';
      }
    }

    const prd = macroStatus === 'SKIP' ? '' : workingPrd;

    // Store macro state
    metadataAny.macro = {
      prd,
      next_step: nextStep,
      status: macroStatus,
      skipped: macroStatus === 'SKIP',
      cycle_count: macroCycles,
      attempts,
      updatedAt: Date.now(),
    };

    // ----------------------------------------------------------------
    // 5. NEXT STEP DELIVERY
    // ----------------------------------------------------------------
    // PRD and next_step live on state.metadata.macro — AgentNode reads them
    // directly. No assistant message injection into graph thread (avoids
    // duplicate assistant messages that violate API contracts).

    // ----------------------------------------------------------------
    // 6. LOG
    // ----------------------------------------------------------------
    const executionTimeMs = Date.now() - startTime;
    console.log(`[MacroNode] Complete — status: ${macroStatus}, cycles: ${macroCycles}, PRD ${prd ? 'present' : 'empty'} (${prd.length} chars), next step: ${nextStep ? 'yes' : 'none'}, in ${executionTimeMs}ms`);

    return { state, decision: { type: 'next' } };
  }

  // ======================================================================
  // CONTEXT BUILDING
  // ======================================================================

  private getLatestUserInstruction(state: BaseThreadState): string {
    const latestUserMessage = [...(state.messages || [])]
      .reverse()
      .find((msg) => msg.role === 'user' && String(msg.content || '').trim());

    return latestUserMessage ? String(latestUserMessage.content).trim() : '';
  }

  private buildUserDirective(userGoal: string, existingPrd: string, attempts: any[]): string {
    const parts: string[] = [];

    parts.push(`User goal: ${userGoal}`);

    if (existingPrd) {
      parts.push(`\n## Current PRD (revise this — do not start from scratch unless approach must fundamentally change)\n${existingPrd}`);
    }

    if (attempts.length > 0) {
      parts.push(`\n## Attempt History (${attempts.length} previous attempts)`);
      parts.push(attempts.map((a: any, i: number) =>
        `Attempt ${i + 1} [${a.status}]: ${a.summary || 'no summary'}`
      ).join('\n'));
    }

    return parts.join('\n');
  }

  // ======================================================================
  // PROMPT BUILDING
  // ======================================================================

  private async buildPromptWithPrdContext(existingPrd: string): Promise<string> {
    if (existingPrd) {
      // Subsequent cycle — show the existing PRD as the current working document
      const prdContext = `The following is the CURRENT working PRD for this project. If the plan is on track, output it unchanged (with any completed steps checked off). Only revise if evidence demands it.

<MACRO_STATUS>
[DRAFT or FINAL or SKIP]
</MACRO_STATUS>

<MACRO_PRD>
${existingPrd}
</MACRO_PRD>

<MACRO_NEXT_STEP>
[Single concrete actionable instruction for the agent — the next unchecked execution step]
</MACRO_NEXT_STEP>`;

      return MACRO_PROMPT.replace('{{PRD_CONTEXT}}', prdContext);
    }

    // First cycle — show the example PRD as a template
    const examplePrd = await getExamplePrd();
    const prdContext = `The following is an EXAMPLE PRD showing the expected format, depth, and structure. Do NOT use this example's content — create a completely new PRD for the user's actual goal. This example only demonstrates the quality and format expected.

<MACRO_STATUS>
[DRAFT or FINAL or SKIP]
</MACRO_STATUS>

<MACRO_PRD>
${examplePrd}
</MACRO_PRD>

<MACRO_NEXT_STEP>
[Single concrete actionable instruction for the agent]
</MACRO_NEXT_STEP>`;

    return MACRO_PROMPT.replace('{{PRD_CONTEXT}}', prdContext);
  }

  // ======================================================================
  // TOOL PRELOADING
  // ======================================================================

  private async preloadReadOperationTools(state: BaseThreadState): Promise<void> {
    try {
      if (!toolRegistry.getToolNames().includes('browse_tools')) {
        return;
      }

      let browseTools: any = null;
      try {
        browseTools = await toolRegistry.getTool('browse_tools');
      } catch {
        return;
      }

      if (!browseTools) {
        return;
      }

      const result = await browseTools.invoke({ operationType: 'read' }, state);
      if (!result?.success) {
        console.warn('[MacroNode] Failed to preload read-operation tools:', result?.error || result?.result);
      }
    } catch (error) {
      console.warn('[MacroNode] Error preloading read-operation tools:', error);
    }
  }

  // ======================================================================
  // XML EXTRACTION
  // ======================================================================

  private extractPrd(rawOutput: string): string {
    const output = this.ensureXmlClosed(rawOutput, 'MACRO_PRD');
    const match = MACRO_PRD_REGEX.exec(output);
    if (!match) {
      return '';
    }
    return String(match[1] || '').trim();
  }

  private extractStatus(rawOutput: string, prd: string, nextStep: string): MacroStatus {
    const output = this.ensureXmlClosed(rawOutput, 'MACRO_STATUS');
    const match = MACRO_STATUS_REGEX.exec(output);
    const raw = String(match?.[1] || '').trim().toUpperCase();

    if (raw === 'SKIP') {
      return 'SKIP';
    }

    if (raw === 'FINAL') {
      return 'FINAL';
    }

    if (raw === 'DRAFT') {
      return 'DRAFT';
    }

    const normalizedNextStep = String(nextStep || '').trim().toUpperCase();
    if (normalizedNextStep === 'SKIP') {
      return 'SKIP';
    }

    if (String(prd || '').trim() && String(nextStep || '').trim()) {
      return 'FINAL';
    }

    return 'DRAFT';
  }

  private extractNextStep(rawOutput: string): string {
    const output = this.ensureXmlClosed(rawOutput, 'MACRO_NEXT_STEP');
    const match = MACRO_NEXT_STEP_REGEX.exec(output);
    if (!match) {
      return '';
    }
    return String(match[1] || '').trim();
  }

  private extractNonWrapperChatter(rawOutput: string): string {
    if (!rawOutput) return '';
    const cleaned = rawOutput
      .replace(/<MACRO_PRD>[\s\S]*?<\/MACRO_PRD>/gi, '')
      .replace(/<MACRO_PRD>[\s\S]*$/gi, '')
      .replace(/<MACRO_STATUS>[\s\S]*?<\/MACRO_STATUS>/gi, '')
      .replace(/<MACRO_STATUS>[\s\S]*$/gi, '')
      .replace(/<MACRO_NEXT_STEP>[\s\S]*?<\/MACRO_NEXT_STEP>/gi, '')
      .replace(/<MACRO_NEXT_STEP>[\s\S]*$/gi, '')
      .trim();
    return cleaned;
  }

  private ensureXmlClosed(rawOutput: string, tagName: string): string {
    const output = String(rawOutput || '').trim();
    if (!output) return '';

    const openRegex = new RegExp(`<${tagName}>`, 'i');
    const closeRegex = new RegExp(`</${tagName}>`, 'i');

    if (openRegex.test(output) && !closeRegex.test(output)) {
      return `${output}\n</${tagName}>`;
    }
    return output;
  }

}
