import { BaseNode, NodeRunPolicy } from './BaseNode';
import { BaseThreadState, NodeResult } from './Graph';
import type { ChatMessage } from '../languagemodels/BaseLanguageModel';
import { skillsRegistry } from '../database/registry/SkillsRegistry';
import { toolRegistry } from '../tools/registry';

type PlannerContext = {
  goal: string;
  userIntent: string;
  criticProjectFeedback: string;
  criticTprd: string;
  selectedSkillSlug: string;
  existingPrd: string;
};

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

const PRD_PROMPT = `Your job right now is Project Manager + Solutions Architect + Skill Architect. 
Your sole responsibility is to create a Project Resource Document (PRD) that will be used
by the graph to complete the users request.

## Progress Communication Rules (strict)

- While working, you MUST communicate your progress in clear, deterministic language.
- Every loop you MUST explicitly state:
  • What you have just done
  • What you plan to do next
  • Any blockers or decisions
- Use short, direct sentences.
- However, when the entire task is finished you MUST stop all explanation and output ONLY the final wrapper block with nothing after it.

## Tool Call Strategy (strict - highest priority)

- In your VERY FIRST response you MUST make ONE single large parallel batch containing EVERY tool call you believe is needed to achieve complete understanding and create the full PRD.
- You are allowed and encouraged to call up to 50 tools in parallel in that first batch.
- Do NOT make small incremental calls (no 1-2 tools at a time).
- Critical: As soon as you've got everything you need from the context, stop and create the PRD, Time is of the essence.

## Rules (must follow)

- Read the assistant messages for tool results and do not repeatedly call tools like "integration_list", "get_credentials" and "browse_tools" as the results are stored in the assistant messages.
- Wrap the finalized PRD in the <FINAL_PRD> block
- The <FINAL_PRD> block must contain the complete, ready-to-use PRD only

## Example PRD:

<FINAL_PRD>
{{SKILL_PRD}}
</FINAL_PRD>
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
    // ----------------------------------------------------------------
    // 1. EXTRACT GOAL AND SKILL CONTEXT FROM STATE
    // ----------------------------------------------------------------
    const planningContext = await this.getPlanningContext(state);
    const prompt = await this.buildPromptWithSkillContext(PRD_PROMPT, planningContext.selectedSkillSlug);
    await this.appendSelectedSkillEnvironmentContextToGraphState(state, planningContext.selectedSkillSlug);
    await this.preloadPlannerReadOperationTools(state);

    // ----------------------------------------------------------------
    // 2. GENERATE PRD — LLM is the only author
    //    Tools are enabled — the LLM researches the environment first,
    //    then outputs the PRD and nothing else.
    // ----------------------------------------------------------------
    const prd = await this.generatePrd(state, prompt, planningContext);

    if (prd) {
      this.storePrd(state, prd);
    } else {
      // LLM failed — leave planning_instructions unset so Graph retry logic triggers
      delete (state.metadata as any).planning_instructions;
      (state.metadata as any).planner = {
        ...((state.metadata as any).planner || {}),
        prd_slug: undefined,
        prd_generated: false,
      };
      console.warn('[PlannerNode] PRD generation failed — graph will retry');
    }

    this.prunePlannerMessagesFromGraphState(state);

    return {
      state,
      decision: { type: 'next' },
    };
  }

  private async preloadPlannerReadOperationTools(state: BaseThreadState): Promise<void> {
    try {
      const browseTools = await toolRegistry.getTool('browse_tools');
      const result = await browseTools.invoke({ operationType: 'read' }, state);
      if (!result?.success) {
        console.warn('[PlannerNode] Failed to preload read-operation tools via browse_tools:', result?.error || result?.result);
      }
    } catch (error) {
      console.warn('[PlannerNode] Error preloading read-operation tools:', error);
    }
  }

  private getPlannerAllowedToolNames(): string[] {
    return toolRegistry
      .getToolNames()
      .filter((toolName) => toolName !== 'browse_tools');
  }

  // ======================================================================
  // CONTEXT EXTRACTION
  // ======================================================================

  private async getPlanningContext(state: BaseThreadState): Promise<PlannerContext> {
    const planRetrieval = (state.metadata as any).planRetrieval || {};
    const userInstruction = this.getLatestUserInstruction(state);

    const goal =
      planRetrieval.goal ||
      userInstruction ||
      planRetrieval.intent ||
      'Complete the requested task';

    const rawUserIntent = String(planRetrieval.intent || '').trim();
    const normalizedGoal = String(goal || '').trim().toLowerCase();
    const normalizedIntent = rawUserIntent.toLowerCase();
    const userIntent = normalizedIntent && normalizedIntent !== normalizedGoal
      ? rawUserIntent
      : '';

    const plannerMeta = (state.metadata as any).planner || {};
    const criticProjectFeedback = plannerMeta.critic_feedback || '';
    const criticTprd = plannerMeta.critic_tprd || '';
    const selectedSkillSlug = planRetrieval.selected_skill_slug || 'No selected skill slug provided.';
    const existingPrd = (state.metadata as any).planning_instructions || '';

    console.log(`[PlannerNode] Goal: "${goal}"`);

    return {
      goal,
      userIntent,
      criticProjectFeedback,
      criticTprd,
      selectedSkillSlug,
      existingPrd,
    };
  }

  // ======================================================================
  // PRD GENERATION
  // ======================================================================

  private async generatePrd(
    state: BaseThreadState,
    prompt: string,
    planningContext: PlannerContext,
  ): Promise<string | null> {

    const enrichedPrompt = await this.enrichPrompt(prompt, state, {
      includeSoul: true,
      includeAwareness: false,
      includeEnvironment: false,
      includeMemory: false
    });

    console.log('[PlannerNode] Generating PRD');

    const policy: Required<NodeRunPolicy> = {
      messageSource: 'custom',
      persistAssistantToGraph: false,
      persistToolResultsToGraph: false,
      persistAssistantToNodeState: true,
      persistToolResultsToNodeState: true,
      nodeStateNamespace: 'planner',
      includeGraphAssistantMessages: true,
      includeGraphUserMessages: false,
    };

    const nodeMessages = await this.buildPlannerNodeMessages(state, policy, planningContext);
    const allowedToolNames = this.getPlannerAllowedToolNames();

    // Tools are intentionally ENABLED — the LLM researches the environment
    // then produces the PRD as its final response when done with tool calls.
    const reply = await this.normalizedChat(state, enrichedPrompt, {
      temperature: 0.3,
      maxTokens: 6144,
      nodeRunPolicy: policy,
      nodeRunMessages: nodeMessages,
      allowedToolNames,
    });

    if (!reply) {
      console.warn('[PlannerNode] LLM returned no content for PRD');
      return null;
    }

    const contentStr = typeof reply.content === 'string' ? reply.content : String(reply.content);
    const nonFinalChatter = this.extractNonFinalPlannerChatter(contentStr);
    if (nonFinalChatter) {
      await this.wsChatMessage(state, nonFinalChatter, 'assistant', 'progress');
    }

    const prdContent = this.extractFinalPrdContent(contentStr);

    if (!this.isArticleYamlCompatible(prdContent)) {
      console.warn('[PlannerNode] Ignoring planner output that is not compatible with article YAML frontmatter');
      return null;
    }

    console.log(`[PlannerNode] PRD generated: ${prdContent.length} chars`);
    return prdContent;
  }

  private extractFinalPrdContent(rawOutput: string): string {
    const output = this.ensureFinalPrdWrapperClosed(rawOutput);
    const wrapperRegex = /<FINAL_PRD>([\s\S]*?)<\/FINAL_PRD>/gi;
    let lastMatchContent: string | null = null;

    for (const match of output.matchAll(wrapperRegex)) {
      const wrapped = String(match?.[1] || '').trim();
      if (wrapped) {
        lastMatchContent = wrapped;
      }
    }

    return (lastMatchContent || output).trim();
  }

  private extractNonFinalPlannerChatter(rawOutput: string): string {
    const output = this.ensureFinalPrdWrapperClosed(rawOutput);
    if (!output.length) {
      return '';
    }

    const withoutFinalPrdBlocks = output
      .replace(/<FINAL_PRD>[\s\S]*?<\/FINAL_PRD>/gi, '')
      .replace(/<FINAL_PRD>[\s\S]*$/gi, '')
      .trim();

    return withoutFinalPrdBlocks;
  }

  private ensureFinalPrdWrapperClosed(rawOutput: string): string {
    const output = String(rawOutput || '').trim();
    if (!output.length) {
      return '';
    }

    const hasOpenTag = /<FINAL_PRD>/i.test(output);
    const hasCloseTag = /<\/FINAL_PRD>/i.test(output);
    if (hasOpenTag && !hasCloseTag) {
      return `${output}\n</FINAL_PRD>`;
    }

    return output;
  }

  private isArticleYamlCompatible(rawOutput: string): boolean {
    const normalizedOutput = this.normalizeStructuredOutput(rawOutput);
    const frontmatterMatch = normalizedOutput.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    if (!frontmatterMatch) {
      return false;
    }

    const meta = this.parseYamlFrontmatter(frontmatterMatch[1]);
    const requiredScalarFields = ['slug', 'title', 'section', 'category'];
    const hasRequiredScalars = requiredScalarFields.every((field) => String(meta?.[field] || '').trim().length > 0);
    if (!hasRequiredScalars) {
      return false;
    }

    const tags = meta?.tags;
    if (Array.isArray(tags)) {
      return tags.length > 0;
    }

    return String(tags || '').trim().length > 0;
  }

  private async buildPromptWithSkillContext(basePrompt: string, selectedSkillSlug: string): Promise<string> {
    const slug = String(selectedSkillSlug || '').trim();
    if (!slug || slug.toLowerCase().includes('no selected skill')) {
      return basePrompt
        .replace('{{SKILL_PLANNER}}', '')
        .replace('{{SKILL_PRD}}', '');
    }

    const skill = await skillsRegistry.getSkill(slug);
    if (!skill) {
      return basePrompt
        .replace('{{SKILL_PLANNER}}', '')
        .replace('{{SKILL_PRD}}', '');
    }

    const plannerSection = String(skill.plannerSection || '').trim();
    const selectedSkillPrdTemplate = await skill.loadPrimaryPrdTemplate();

    const plannerBlock = [
      '## Selected Skill Planner Section',
      plannerSection,
    ].join('\n\n');

    const skillPrdBlock = selectedSkillPrdTemplate
      ? [
          '## Selected Skill PRD Template',
          selectedSkillPrdTemplate,
        ].join('\n\n')
      : '';

    return basePrompt
      .replace('{{SKILL_PLANNER}}', plannerSection ? plannerBlock : '')
      .replace('{{SKILL_PRD}}', skillPrdBlock);
  }

  private async buildPlannerNodeMessages(
    state: BaseThreadState,
    policy: Required<NodeRunPolicy>,
    planningContext: PlannerContext,
  ): Promise<{
    assistantMessages: ChatMessage[];
    userMessages: ChatMessage[];
  }> {
    const {
      goal,
      userIntent,
      criticProjectFeedback,
      criticTprd,
      selectedSkillSlug,
      existingPrd,
    } = planningContext;

    const plannerContextMessages: ChatMessage[] = [];

    const selectedSkillContextMessages = await this.buildSelectedSkillAssistantMessages(selectedSkillSlug);
    plannerContextMessages.push(...selectedSkillContextMessages);

    const normalizedGoal = String(goal || '').trim().toLowerCase();
    const plannerHistoryMessages = (((state.metadata as any).planner?.messages || []) as ChatMessage[])
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

        const lowerContent = content.toLowerCase();
        const isLegacySharedContext = lowerContent.startsWith('environment systems and tools context:')
          || lowerContent.startsWith('observational memory snapshot:')
          || lowerContent.startsWith('# environment');
        if (isLegacySharedContext) {
          return false;
        }

        if (!normalizedGoal) {
          return true;
        }

        const normalizedContent = lowerContent;
        const isGoalEcho = normalizedContent === normalizedGoal
          || normalizedContent.startsWith(`${normalizedGoal}\nslug:`)
          || normalizedContent.startsWith(`goal:\n${normalizedGoal}`);

        return !isGoalEcho;
      })
      .map((message) => ({ ...message }));

    plannerContextMessages.push(...plannerHistoryMessages);

    const completedChecksMessage = this.buildCompletedChecksAssistantMessage(state);
    if (completedChecksMessage) {
      plannerContextMessages.push(completedChecksMessage);
    }

    if (existingPrd.trim()) {
      plannerContextMessages.push({
        role: 'assistant',
        content: `Existing PRD (this is what needs revision):\n${existingPrd}`,
      });
    }

    if (criticTprd.trim()) {
      plannerContextMessages.push({
        role: 'assistant',
        content: `Latest technical execution brief:\n${criticTprd}`,
      });
    }

    const plannerDirective: ChatMessage = {
      role: 'user',
      content: `${goal}`,
    };

    if (criticProjectFeedback.trim()) {
      plannerContextMessages.push({
        role: 'user',
        content: `Critic project feedback:\n${criticProjectFeedback}`,
      });
    }

    const assistantMessages = this.dedupePlannerSharedContextAssistantMessages(plannerContextMessages);
    const userMessages = [plannerDirective];

    return {
      assistantMessages,
      userMessages,
    };
  }

  private dedupePlannerSharedContextAssistantMessages(messages: ChatMessage[]): ChatMessage[] {
    const seenSharedContextKeys = new Set<string>();
    const result: ChatMessage[] = [];

    for (const message of messages) {
      if (message.role !== 'assistant') {
        result.push(message);
        continue;
      }

      const kind = String((message as any)?.metadata?.kind || '').trim();
      const content = String(message.content || '').trim();
      const normalizedContent = content.toLowerCase();

      let sharedContextKey = '';
      if (kind.startsWith('shared_context_')) {
        sharedContextKey = kind;
      } else if (normalizedContent.startsWith('environment systems and tools context:')) {
        sharedContextKey = 'shared_context_environment';
      } else if (normalizedContent.startsWith('observational memory snapshot:')) {
        sharedContextKey = 'shared_context_observational_memory';
      } else if (normalizedContent.startsWith('# environment')) {
        sharedContextKey = 'shared_context_skill_environment';
      }

      if (sharedContextKey) {
        if (seenSharedContextKeys.has(sharedContextKey)) {
          continue;
        }
        seenSharedContextKeys.add(sharedContextKey);
      }

      result.push(message);
    }

    return result;
  }

  private buildCompletedChecksAssistantMessage(state: BaseThreadState): ChatMessage | null {
    const plannerMeta = (state.metadata as any).planner || {};
    const toolRuns = Array.isArray(plannerMeta.toolRuns) ? plannerMeta.toolRuns : [];
    if (toolRuns.length === 0) {
      return null;
    }

    const latestByDedupeKey = new Map<string, any>();
    for (const run of toolRuns) {
      if (!run || typeof run !== 'object') {
        continue;
      }

      const toolName = String(run.toolName || '').trim();
      if (!toolName) {
        continue;
      }

      const dedupeKey = String(run.dedupeKey || `${toolName}:${this.stableStringifyForPlanner(run.args ?? {})}`);
      latestByDedupeKey.set(dedupeKey, run);
    }

    const latestRuns = Array.from(latestByDedupeKey.values())
      .sort((a, b) => Number(a?.timestamp || 0) - Number(b?.timestamp || 0))
      .slice(-20);

    if (latestRuns.length === 0) {
      return null;
    }

    const lines = latestRuns.map((run: any) => {
      const toolName = String(run.toolName || 'unknown_tool');
      const argsText = this.formatToolArgs(run.args);
      const statusText = run.success
        ? this.summarizeToolRunResult(run.result)
        : `failed: ${String(run.error || 'unknown error')}`;
      return `- ${toolName}${argsText} => ${statusText}`;
    });

    return {
      role: 'assistant',
      content: [
        'Already completed checks in this planner context (avoid rerunning unless inputs changed):',
        ...lines,
      ].join('\n'),
    };
  }

  private formatToolArgs(args: unknown): string {
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      return '';
    }

    const entries = Object.entries(args as Record<string, unknown>);
    if (entries.length === 0) {
      return '';
    }

    const parts = entries
      .slice(0, 4)
      .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`);

    return `(${parts.join(', ')})`;
  }

  private summarizeToolRunResult(result: unknown): string {
    const envelope = result && typeof result === 'object' && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : null;
    const raw = envelope && 'result' in envelope ? envelope.result : result;
    const serialized = typeof raw === 'string' ? raw : JSON.stringify(raw ?? 'success');
    const compact = String(serialized || 'success').replace(/\s+/g, ' ').trim();
    if (!compact.length) {
      return 'success';
    }

    return compact;
  }

  private stableStringifyForPlanner(value: unknown): string {
    const normalize = (input: unknown): unknown => {
      if (Array.isArray(input)) {
        return input.map((item) => normalize(item));
      }

      if (!input || typeof input !== 'object') {
        return input;
      }

      const record = input as Record<string, unknown>;
      const sortedKeys = Object.keys(record).sort((a, b) => a.localeCompare(b));
      const normalized: Record<string, unknown> = {};
      for (const key of sortedKeys) {
        normalized[key] = normalize(record[key]);
      }

      return normalized;
    };

    return JSON.stringify(normalize(value));
  }

  private async buildSelectedSkillAssistantMessages(selectedSkillSlug: string): Promise<ChatMessage[]> {
    const slug = String(selectedSkillSlug || '').trim();
    if (!slug || slug.toLowerCase().includes('no selected skill')) {
      return [{
        role: 'assistant',
        content: 'SELECTED_SKILL_MANIFEST\nnone',
      }];
    }

    const skill = await this.resolveSkillBySelectedSlug(slug);
    if (!skill) {
      return [{
        role: 'assistant',
        content: `SELECTED_SKILL_MANIFEST\nnot_found: ${slug}`,
      }];
    }

    const manifestMessage: ChatMessage = {
      role: 'assistant',
      content: skill.getManifestAssistantMessage(),
    };

    const loadedResources = await skill.loadPlannerResources();
    const nonPrdResources = loadedResources.filter((resource: any) => {
      const resourcePath = String(resource?.path || '').trim().toLowerCase();
      const resourceType = String(resource?.type || '').trim().toLowerCase();
      const normalizedContent = String(resource?.content || '').trim().toLowerCase();
      const isPrdTemplatePath = resourcePath.includes('/templates/prd.') || resourcePath.endsWith('/templates/prd.ts');
      const isPrdTemplateType = resourceType === 'template' && resourcePath.includes('/templates/');
      const isEnvironmentResource = resourceType === 'environment'
        || normalizedContent.startsWith('# environment')
        || normalizedContent.startsWith('## environment')
        || normalizedContent.startsWith('## dev environment');

      return !(isPrdTemplatePath || isPrdTemplateType || isEnvironmentResource);
    });

    const resourceMessages: ChatMessage[] = nonPrdResources.map((resource: any) => ({
      role: 'assistant',
      content: String(resource.content || '').trim(),
    }));

    return [manifestMessage, ...resourceMessages];
  }

  private async appendSelectedSkillEnvironmentContextToGraphState(
    state: BaseThreadState,
    selectedSkillSlug: string,
  ): Promise<void> {
    const existingMessages = Array.isArray(state.messages) ? state.messages : [];
    const retainedMessages = existingMessages.filter((message: any) => {
      const metadata = message?.metadata || {};
      const kind = String(metadata?.kind || '').trim();
      return kind !== 'shared_context_skill_environment';
    });

    const skill = await this.resolveSkillBySelectedSlug(selectedSkillSlug);
    if (!skill) {
      if (retainedMessages.length !== existingMessages.length) {
        state.messages = retainedMessages;
        this.bumpStateVersion(state);
      }
      return;
    }

    const loadedResources = await skill.loadPlannerResources();
    const environmentResource = loadedResources.find((resource: any) => {
      const resourceType = String(resource?.type || '').trim().toLowerCase();
      const normalizedContent = String(resource?.content || '').trim().toLowerCase();
      return resourceType === 'environment'
        || normalizedContent.startsWith('# environment')
        || normalizedContent.startsWith('## environment')
        || normalizedContent.startsWith('## dev environment');
    });

    const environmentContent = String(environmentResource?.content || '').trim();
    if (!environmentContent) {
      if (retainedMessages.length !== existingMessages.length) {
        state.messages = retainedMessages;
        this.bumpStateVersion(state);
      }
      return;
    }

    state.messages = [
      ...retainedMessages,
      {
        role: 'assistant',
        content: environmentContent,
        metadata: {
          nodeId: this.id,
          nodeName: this.name,
          kind: 'shared_context_skill_environment',
          selectedSkillSlug: String(selectedSkillSlug || '').trim(),
          timestamp: Date.now(),
        },
      } as ChatMessage,
    ];
    this.bumpStateVersion(state);
  }

  private async resolveSkillBySelectedSlug(selectedSkillSlug: string): Promise<any | null> {
    const rawSlug = String(selectedSkillSlug || '').trim();
    if (!rawSlug) {
      return null;
    }

    const direct = await skillsRegistry.getSkill(rawSlug);
    if (direct) {
      return direct;
    }

    const prefixedCandidates = [
      rawSlug.startsWith('sop-') ? rawSlug.replace(/^sop-/, 'skill-') : '',
      rawSlug.startsWith('skill-') ? rawSlug.replace(/^skill-/, 'sop-') : '',
    ].filter(Boolean);

    for (const candidate of prefixedCandidates) {
      const byPrefixSwap = await skillsRegistry.getSkill(candidate);
      if (byPrefixSwap) {
        return byPrefixSwap;
      }
    }

    return null;
  }

  private getLatestUserInstruction(state: BaseThreadState): string {
    const latestUserMessage = [...(state.messages || [])]
      .reverse()
      .find((msg) => msg.role === 'user' && String(msg.content || '').trim());

    return latestUserMessage ? String(latestUserMessage.content).trim() : '';
  }

  private prunePlannerMessagesFromGraphState(state: BaseThreadState): void {
    const originalMessages = Array.isArray(state.messages) ? state.messages : [];
    const filteredMessages = originalMessages.filter((message: any) => {
      const metadata = message?.metadata || {};
      const nodeId = String(metadata?.nodeId || '').trim().toLowerCase();
      const nodeName = String(metadata?.nodeName || '').trim().toLowerCase();

      if (nodeId === 'planner' || nodeName === 'planner') {
        return false;
      }

      return true;
    });

    if (filteredMessages.length !== originalMessages.length) {
      state.messages = filteredMessages;
    }
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
    const selectedSkillSlug = String((state.metadata as any).planRetrieval?.selected_skill_slug || '').trim();
    const parsed = this.prepareArticleFromStructuredOutput(prd, {
      fallbackSlugSource: goal,
      fallbackTitle: goal,
      fallbackHeader: 'Project Resource Document',
      defaultSection: 'Projects',
      defaultCategory: 'Projects',
      defaultTags: ['skill'],
    });

    if (selectedSkillSlug !== 'learn-skill') {
      const tags = Array.isArray(parsed.meta.tags)
        ? parsed.meta.tags
        : String(parsed.meta.tags || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);

      parsed.meta.tags = tags.filter((tag) => String(tag || '').trim().toLowerCase() !== 'skill');
    }

    return parsed;
  }

  private async savePrdArticleAsync(meta: Record<string, any>, document: string): Promise<void> {
    await this.saveArticleAsync(meta, document, 'PlannerNode');
  }
}
