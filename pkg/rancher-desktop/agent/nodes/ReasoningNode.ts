import { BaseNode, ENVIRONMENT_PROMPT, NodeRunPolicy, OBSERVATIONAL_MEMORY_SOP } from './BaseNode';
import type { BaseThreadState, NodeResult } from './Graph';
import { ActivePlanManager } from './ActivePlanManager';
import type { ChatMessage } from '../languagemodels/BaseLanguageModel';
import { SullaSettingsModel } from '../database/models/SullaSettingsModel';
import { skillsRegistry } from '../database/registry/SkillsRegistry';
import { toolRegistry } from '../tools';

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

const REASONING_PROMPT_SUFFIX = `Your only job is to output a Technical Execution Brief for the Action Node.

MISSION: Turn non-technical PRD + state into ONE precise next-cycle brief.
NEVER execute, NEVER tool call, NEVER explain, NEVER solve anything.

STRICT OUTPUT RULE:
Output NOTHING except the exact block below. No intro. No thinking. No closing. No tools.

<TECHNICAL_EXECUTION_BRIEF>
### Technical Execution Brief

**FOCUS**
{{current_focus}}

**Delta Only**
- New vs last state only
- Key changes (flow, modules, risks)

**Success Metrics**
1-2 measurable outcomes this cycle

**Execution Plan**
1. First concrete step
2. Second
... (max 6)

**Required Tools**
- tool: params (new only)

**State Refs**
- conversationSummaries: [top 2-3]
- activePlans: [relevant]
- skill: {{skill_slug}} (if high)

**Immediate Action**
One crystal-clear sentence for Action Node
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

  private buildEnvironmentContextAssistantMessage(): string {
    let environmentContext = ENVIRONMENT_PROMPT;

    const categoriesWithDesc = toolRegistry.getCategoriesWithDescriptions();
    const categoriesText = categoriesWithDesc
      .map(({ category, description }) => `- ${category}: ${description}`)
      .join('\n');
    environmentContext = environmentContext.replace('{{tool_categories}}', categoriesText);

    const formattedTime = new Date().toLocaleString('en-US', {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';

    environmentContext = environmentContext.replace('{{formattedTime}}', formattedTime);
    environmentContext = environmentContext.replace('{{timeZone}}', timeZone);

    return environmentContext.trim();
  }

  private async getObservationalMemorySnapshot(): Promise<string> {
    try {
      const observationalMemory = await SullaSettingsModel.get('observationalMemory', {});
      const raw =
        typeof observationalMemory === 'string'
          ? JSON.parse(observationalMemory || '[]')
          : observationalMemory;

      if (!Array.isArray(raw) || raw.length === 0) {
        return 'No observational memory entries available.';
      }

      return raw
        .slice(-10)
        .map((entry: any) => `${entry?.priority || ''} ${entry?.timestamp || ''} ${entry?.content || ''}`.trim())
        .filter((line: string) => Boolean(line))
        .join('\n');
    } catch (error) {
      console.warn('[ReasoningNode] Failed to read observational memory snapshot:', error);
      return 'Observational memory unavailable due to parse/read error.';
    }
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
      includeGraphAssistantMessages: false,
      includeGraphUserMessages: false,
    };

    const nodeMessages = await this.buildReasoningNodeMessages(state, policy);

    const content = await this.chat(state, systemPrompt, {
      temperature: 0.2,
      maxTokens: 4096,
      nodeRunPolicy: policy,
      nodeRunMessages: nodeMessages,
      allowedToolOperations: ['read'],
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
      return lastBlockContent;
    }

    const fallbackMatch = output.match(/###\s+Technical\s+Execution\s+Brief[\s\S]*/i);
    if (fallbackMatch && String(fallbackMatch[0] || '').trim()) {
      return String(fallbackMatch[0]).trim();
    }

    return null;
  }

  private async buildReasoningNodeMessages(_state: BaseThreadState, policy: Required<NodeRunPolicy>): Promise<{
    assistantMessages: ChatMessage[];
    userMessages: ChatMessage[];
  }> {
    const selectedSkillEnvironmentMessage = await this.getSelectedSkillEnvironmentAssistantMessage(_state);
    const planningInstructions = String((_state.metadata as any).planning_instructions || '').trim();
    const planningInstructionsMessage: ChatMessage | null = planningInstructions
      ? {
          role: 'assistant',
          content: `Project Resource Document (planning instructions):\n${planningInstructions}`,
        }
      : null;

    const environmentContextMessage: ChatMessage = {
      role: 'assistant',
      content: `Environment systems and tools context:\n${this.buildEnvironmentContextAssistantMessage()}`,
    };
    const observationalMemoryMessage: ChatMessage = {
      role: 'assistant',
      content: `Observational memory snapshot:\n${await this.getObservationalMemorySnapshot()}`,
    };
    const observationalMemorySopMessage: ChatMessage = {
      role: 'assistant',
      content: OBSERVATIONAL_MEMORY_SOP,
    };

    const reasoningHistoryMessages = (((_state.metadata as any).reasoning?.messages || []) as ChatMessage[])
      .filter((message) => message.role === 'assistant' && String(message.content || '').trim().length > 0)
      .map((message) => ({ ...message }));

    const userDirective: ChatMessage = {
      role: 'user',
      content: 'Generate the Technical Execution Brief for the logical next steps in this project.',
    };

    const assistantMessages = this.buildAssistantMessagesForNode(_state, policy, [
      environmentContextMessage,
      observationalMemoryMessage,
      observationalMemorySopMessage,
      ...(selectedSkillEnvironmentMessage ? [selectedSkillEnvironmentMessage] : []),
      ...(planningInstructionsMessage ? [planningInstructionsMessage] : []),
      ...reasoningHistoryMessages,
    ]);
    const userMessages = this.buildUserMessagesForNode(_state, policy, [userDirective]);

    return {
      assistantMessages,
      userMessages,
    };
  }

  private async getSelectedSkillEnvironmentAssistantMessage(state: BaseThreadState): Promise<ChatMessage | null> {
    const selectedSkillSlug = String((state.metadata as any).planRetrieval?.selected_skill_slug || '').trim();
    if (!selectedSkillSlug) {
      return null;
    }

    const skill = await skillsRegistry.getSkill(selectedSkillSlug);
    if (!skill) {
      return null;
    }

    const loadedResources = await skill.loadPlannerResources();
    const environmentResource = loadedResources.find((resource) => {
      const resourceType = String(resource.type || '').trim().toLowerCase();
      const normalizedContent = String(resource.content || '').trim().toLowerCase();
      const contentLooksLikeEnvironment =
        normalizedContent.startsWith('# environment')
        || normalizedContent.startsWith('## environment')
        || normalizedContent.startsWith('## dev environment');

      return resourceType === 'environment' || contentLooksLikeEnvironment;
    });

    if (!environmentResource?.content) {
      return null;
    }

    return {
      role: 'assistant',
      content: String(environmentResource.content || '').trim(),
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
}
