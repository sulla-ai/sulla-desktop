import { BaseNode, NodeRunPolicy } from './BaseNode';
import type { BaseThreadState, NodeResult } from './Graph';
import { ActivePlanManager } from './ActivePlanManager';
import type { ChatMessage } from '../languagemodels/BaseLanguageModel';

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

const REASONING_PROMPT_SUFFIX = `Your job is to create a Technical Execution Brief (TEB) for the Action Node.

You are the incremental manager walking the Action Node through the PRD step-by-step using ONLY the "Execution Steps" section in the PRD as your master roadmap.

You break every PRD into the smallest possible verifiable chunks so the Action Node is never overwhelmed.

Your TEB will have one clear and concise focus and will advance exactly ONE checkbox from the PRD’s Execution Steps list.

MISSION: Turn the PRD + current state into ONE precise next-cycle brief for the Action Node.
NEVER execute, NEVER tool call, NEVER explain, NEVER solve anything.

## Incremental Execution Strategy (highest priority — never violate)
- ALWAYS look at the "## Execution Steps" section in the PRD.
- Identify the next logical step.
- Create a TEB that advances ONLY that one next logical step (checkbox).
- The graph will return to you after the Action Node completes the step so you can pick the next unchecked checkbox.
- One TEB = one checkbox advancement. Never bundle multiple checkboxes into a single TEB.
- The number of steps will vary (3–25) — always choose the smallest high-value next step that can be fully built and verified in one cycle.
- If a step has a known blocker, create a TEB that implements the fallback defined in the PRD and clearly documents the blocker for the human.

ONE-SHOT RULES (strict):
- This is a one-shot TEB writer, not a researcher.
- Use only the context already present in messages/state and the PRD.
- Do NOT add new PRD scope, new architecture, or speculative context.
- Do NOT request discovery/research in this step.
- Do NOT propose re-checking tools/integrations unless explicitly marked unknown in existing context.

CONTEXT TRANSFER RULES (strict):
- Assume ActionNode should NOT need to re-search for information that is already known.
- If discovery was already done, include the concrete results in the TEB.
- If credential/integration checks were already done, include exactly what is known and what is missing.
- Convert PRD context + prior tool results into explicit, actionable instructions and facts.
- Always prefer execution using known facts over introducing new information requests.
- Explicitly state: "No additional discovery required for this cycle." unless existing context explicitly marks a hard blocker as unknown.

OUTPUT RULE: When ready output the technical execution brief wthin these xml tags 

<TECHNICAL_EXECUTION_BRIEF>
### Technical Execution Brief

**GOAL**
This is the goal of this step: we want [clear one-sentence goal of this specific step].

**Goal & Required Properties**
This step must deliver these exact things so later steps work correctly:

- [short description of property 1]
- [short description of property 2]
- [short description of property 3]
- [etc.]

This is the required outcome defined in the PRD so the next steps can proceed safely.

**Delta Only**
- New vs last state only
- Key changes (flow, modules, risks)

**Success Metrics**
1-2 measurable outcomes this cycle

**Execution Context (Required)**
- Discovery already completed: [key findings ActionNode should trust and reuse]
- Credentials/integrations status: [ready/missing + exact details relevant to this cycle]
- Artifacts/templates already chosen: [ids/slugs/names and why]
- Known blockers + dependencies: [only concrete blockers]
- Re-check policy: [what must NOT be re-checked this cycle]

**Immediate Action**
One crystal-clear sentence for Action Node describing the one step to execute now
</TECHNICAL_EXECUTION_BRIEF>
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
      includeSoul: true,
      includeAwareness: false,
      includeEnvironment: false,
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

    this.finalizeReasoningMessagesInGraphState(state, technicalInstructions);

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
    const prd = ((state.metadata as any).planning_instructions || '').trim();
    const planningInstructionsSection = prd
      ? `## The Project PRD\n\n\`\`\`\n${prd}\n\`\`\``
      : '';
    const previousActionResult = this.getPreviousActionResult(state);
    const previousActionResultsSection = previousActionResult
      ? `## Previous Action Results\n\n\`\`\`\n${previousActionResult}\n\`\`\``
      : '';
    const criticFeedback = ((state.metadata as any).reasoning?.critic_feedback || '').trim();
    const criticFeedbackSection = criticFeedback
      ? `## Critic Technical Feedback\n\n\`\`\`\n${criticFeedback}\n\`\`\``
      : '';

    return basePrompt
      .replace('{{planning_instructions_section}}', planningInstructionsSection)
      .replace('{{previous_action_results_section}}', previousActionResultsSection)
      .replace('{{critic_feedback_section}}', criticFeedbackSection);
  }

  /**
   * 
   * @param state 
   * @param systemPrompt 
   * @returns 
   */
  private async generateTechnicalInstructions(state: BaseThreadState, systemPrompt: string): Promise<string | null> {
    const policy: Required<NodeRunPolicy> = {
      messageSource: 'custom',
      persistAssistantToGraph: false,
      persistToolResultsToGraph: false,
      persistAssistantToNodeState: true,
      persistToolResultsToNodeState: false,
      nodeStateNamespace: 'reasoning',
      includeGraphAssistantMessages: true,
      includeGraphUserMessages: false,
    };

    const nodeMessages = await this.buildReasoningNodeMessages(state, policy);

    const content = await this.chat(state, systemPrompt, {
      temperature: 0.2,
      maxTokens: 4096,
      disableTools: true,
      nodeRunPolicy: policy,
      nodeRunMessages: nodeMessages,
    });

    if (!content) {
      console.warn('[ReasoningNode] LLM returned empty technical instructions');
      return null;
    }

    const contentStr = typeof content === 'string' ? content.trim() : String(content).trim();
    const extractedBrief = this.extractTechnicalExecutionBriefContent(contentStr);
    if (!extractedBrief) {
      console.warn('[ReasoningNode] LLM response did not contain a TECHNICAL_EXECUTION_BRIEF block');
      return null;
    }

    return extractedBrief;
  }

  private extractTechnicalExecutionBriefContent(rawOutput: string): string | null {
    const output = String(rawOutput || '').trim();
    if (!output) {
      return null;
    }

    const xmlBlockRegex = /<TECHNICAL_EXECUTION_BRIEF>([\s\S]*?)<\/TECHNICAL_EXECUTION_BRIEF>/gi;
    let lastBlockContent: string | null = null;
    for (const match of output.matchAll(xmlBlockRegex)) {
      const block = String(match?.[1] || '').trim();
      if (block) {
        lastBlockContent = block;
      }
    }

    if (lastBlockContent) {
      return this.stripTechnicalExecutionBriefXml(lastBlockContent);
    }

    const fallbackMatch = output.match(/###\s+Technical\s+Execution\s+Brief[\s\S]*/i);
    if (fallbackMatch && String(fallbackMatch[0] || '').trim()) {
      return this.stripTechnicalExecutionBriefXml(String(fallbackMatch[0]).trim());
    }

    return null;
  }

  private stripTechnicalExecutionBriefXml(content: string): string {
    return String(content || '')
      .replace(/<\/?TECHNICAL_EXECUTION_BRIEF>/gi, '')
      .trim();
  }

  private finalizeReasoningMessagesInGraphState(state: BaseThreadState, technicalInstructions: string | null): void {
    const originalMessages = Array.isArray(state.messages) ? state.messages : [];
    const filteredMessages = originalMessages.filter((message: any) => {
      const metadata = message?.metadata || {};
      const nodeId = String(metadata?.nodeId || '').trim().toLowerCase();
      const nodeName = String(metadata?.nodeName || '').trim().toLowerCase();

      if (nodeId === 'reasoning' || nodeName === 'reasoning') {
        return false;
      }

      return true;
    });

    if (technicalInstructions && technicalInstructions.trim()) {
      filteredMessages.push({
        role: 'assistant',
        content: technicalInstructions.trim(),
        metadata: {
          nodeId: this.id,
          nodeName: this.name,
          kind: 'technical_execution_brief',
          timestamp: Date.now(),
        },
      } as ChatMessage);
    }

    if (filteredMessages.length !== originalMessages.length || (technicalInstructions && technicalInstructions.trim())) {
      state.messages = filteredMessages;
      this.bumpStateVersion(state);
    }
  }

  private async buildReasoningNodeMessages(_state: BaseThreadState, policy: Required<NodeRunPolicy>): Promise<{
    assistantMessages: ChatMessage[];
    userMessages: ChatMessage[];
  }> {
    const executionReadinessContextMessage = this.buildExecutionReadinessContextMessage(_state);
    const planningInstructions = String((_state.metadata as any).planning_instructions || '').trim();
    const planningInstructionsMessage: ChatMessage | null = planningInstructions
      ? {
          role: 'assistant',
          content: `Project Resource Document (planning instructions):\n${planningInstructions}`,
        }
      : null;

    const reasoningHistoryMessages = (((_state.metadata as any).reasoning?.messages || []) as ChatMessage[])
      .filter((message) => {
        if (message.role !== 'assistant') {
          return false;
        }

        const kind = String((message as any)?.metadata?.kind || '').trim();
        if (kind.startsWith('shared_context_')) {
          return false;
        }

        const content = String(message.content || '').trim();
        if (!content.length) {
          return false;
        }

        const normalizedContent = content.toLowerCase();
        const isContextReplay = normalizedContent.startsWith('project resource document (planning instructions):')
          || normalizedContent.startsWith('execution-readiness snapshot from prior cycles')
          || normalizedContent.startsWith('environment systems and tools context:')
          || normalizedContent.startsWith('observational memory snapshot:')
          || normalizedContent.startsWith('# environment');

        return !isContextReplay;
      })
      .map((message) => ({
        ...message,
        content: this.stripTechnicalExecutionBriefXml(String(message.content || '')),
      }))
      .filter((message) => String(message.content || '').trim().length > 0);

    const userDirective: ChatMessage = {
      role: 'user',
      content: 'Generate the Technical Execution Brief for the logical next steps in this project.',
    };

    const assistantMessages = this.dedupeReasoningAssistantMessages([
      ...(executionReadinessContextMessage ? [executionReadinessContextMessage] : []),
      ...(planningInstructionsMessage ? [planningInstructionsMessage] : []),
      ...reasoningHistoryMessages,
    ]);
    const userMessages = [userDirective];

    return {
      assistantMessages,
      userMessages,
    };
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

  private getPreviousActionResult(state: BaseThreadState): string | null {
    const actions = (state.metadata as any).actions || [];
    if (actions.length === 0) return null;

    const lastAction = actions[actions.length - 1];
    const status = lastAction.success ? 'SUCCESS' : 'FAILED';
    const result = typeof lastAction.result === 'string'
      ? lastAction.result.substring(0, 500)
      : JSON.stringify(lastAction.result || '').substring(0, 500);

    return `Last action [${status}]: ${lastAction.action_type || 'unknown'}\nResult: ${result}`;
  }

  private buildExecutionReadinessContextMessage(state: BaseThreadState): ChatMessage | null {
    const metadataAny = state.metadata as any;
    const toolRuns = Array.isArray(metadataAny?.__toolRuns) ? metadataAny.__toolRuns : [];
    if (toolRuns.length === 0) {
      return null;
    }

    const latestRuns = [...toolRuns]
      .sort((a: any, b: any) => Number(a?.timestamp || 0) - Number(b?.timestamp || 0))
      .slice(-40);

    const discoveryRuns = latestRuns.filter((run: any) => {
      const toolName = String(run?.toolName || '').toLowerCase();
      return (
        toolName.includes('search')
        || toolName.includes('list')
        || toolName.includes('browse')
        || toolName.includes('template')
        || toolName.includes('workflow')
      );
    });

    const credentialRuns = latestRuns.filter((run: any) => {
      const toolName = String(run?.toolName || '').toLowerCase();
      return (
        toolName.includes('credential')
        || toolName.includes('integration')
      );
    });

    const formatRuns = (runs: any[]): string[] => runs.map((run: any) => {
      const toolName = String(run?.toolName || 'unknown_tool');
      const args = run?.args && typeof run.args === 'object' ? JSON.stringify(run.args) : '{}';
      const status = run?.success ? 'ok' : 'failed';
      const rawResult = run?.success ? run?.result : run?.error;
      const resultText = String(typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult || ''))
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 220);
      return `- ${toolName} ${args} => ${status}${resultText ? ` | ${resultText}` : ''}`;
    });

    const sharedContextMessages = (Array.isArray(state.messages) ? state.messages : [])
      .filter((message: any) => {
        if (message?.role !== 'assistant') return false;
        const kind = String(message?.metadata?.kind || '').trim();
        return kind.startsWith('shared_context_');
      })
      .slice(-8)
      .map((message: any) => String(message?.content || '').trim())
      .filter((content: string) => content.length > 0)
      .map((content: string) => `- ${content.replace(/\s+/g, ' ').slice(0, 240)}`);

    const lines: string[] = [
      'Execution-readiness snapshot from prior cycles (reuse these results; avoid redundant lookups):',
      'Shared context messages:',
      ...(sharedContextMessages.length > 0 ? sharedContextMessages : ['- none']),
      'Discovery/tooling checks already performed:',
      ...(discoveryRuns.length > 0 ? formatRuns(discoveryRuns) : ['- none']),
      'Credential/integration checks already performed:',
      ...(credentialRuns.length > 0 ? formatRuns(credentialRuns) : ['- none']),
      'When writing TEB, treat successful checks above as known facts unless newer contradictory evidence exists.',
    ];

    return {
      role: 'assistant',
      content: lines.join('\n'),
    };
  }

  private dedupeReasoningAssistantMessages(messages: ChatMessage[]): ChatMessage[] {
    const seenKeys = new Set<string>();
    const result: ChatMessage[] = [];

    for (const message of messages) {
      if (message.role !== 'assistant') {
        result.push(message);
        continue;
      }

      const kind = String((message as any)?.metadata?.kind || '').trim();
      const content = String(message.content || '').trim();
      const normalizedContent = content.toLowerCase();

      let key = '';
      if (kind.startsWith('shared_context_')) {
        key = kind;
      } else if (normalizedContent.startsWith('environment systems and tools context:')) {
        key = 'shared_context_environment';
      } else if (normalizedContent.startsWith('observational memory snapshot:')) {
        key = 'shared_context_observational_memory';
      } else if (normalizedContent.startsWith('# environment')) {
        key = 'shared_context_skill_environment';
      } else if (normalizedContent.startsWith('project resource document (planning instructions):')) {
        key = 'planning_instructions_message';
      } else if (normalizedContent.startsWith('execution-readiness snapshot from prior cycles')) {
        key = 'execution_readiness_snapshot';
      }

      if (key) {
        if (seenKeys.has(key)) {
          continue;
        }
        seenKeys.add(key);
      }

      result.push(message);
    }

    return result;
  }
}
