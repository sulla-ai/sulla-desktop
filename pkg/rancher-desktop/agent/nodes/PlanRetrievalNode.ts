// PlanRetrievalNode.ts
// Fast information extraction node for intent classification and keyword pulling
// Returns structured data for goal setting, skill search, and memory search
//
// Key Features:
// - Intent classification (lead_qualification, appointment_booking, etc)
// - Goal extraction from user messages
// - Skill and memory search keyword identification
// - Low temperature for consistency
// - JSON-only response with no tools

import type { BaseThreadState, NodeResult } from './Graph';
import { BaseNode, ENVIRONMENT_PROMPT, JSON_ONLY_RESPONSE_INSTRUCTIONS, NodeRunPolicy } from './BaseNode';
import { articlesRegistry } from '../database/registry/ArticlesRegistry';
import { skillsRegistry } from '../database/registry/SkillsRegistry';
import { ActivePlanManager } from './ActivePlanManager';
import { SullaSettingsModel } from '../database/models/SullaSettingsModel';
import { toolRegistry } from '../tools';
import type { ChatMessage } from '../languagemodels/BaseLanguageModel';

// ============================================================================
// INTERFACES
// ============================================================================

interface PlanRetrievalResponse {
  intent: string;
  goal: string;
  selected_skill_slug: string | null;
  complexity: 'high' | 'medium' | 'low';
  memory_search: string[];
}

interface SkillSummaryEntry {
  slug: string;
  name: string;
  triggers: string[];
  description: string;
}

// ============================================================================
// PLAN RETRIEVAL PROMPT
// ============================================================================

const PLAN_RETRIEVAL_PROMPT = `You are a specialized planning and intent analysis system.

Use the full conversation thread for continuity and context.
Classify intent and goal based primarily on the user's latest message.

Available skills are provided in the SKILLS CONTEXT section. Use them to select selected_skill_slug.

## Strict Complexity Rules (exact order)

1. Skill trigger matches perfectly? → selected_skill_slug = slug, complexity = "high"

2. ANY external action/tool/live data? → complexity = "medium"
   - Check/test/verify status (Slack, API, connection, webhook, sync, etc.)
   - "check the", "test the", "status of", "verify if", "how many currently"
   - Fetch current info not in context
   - Run code_execution, API call, browse, search

3. Else → complexity = "low"

Examples:
- "how are you" → low
- "check the slack connection", "test API status", "verify FB lead sync" → medium
- "build lead scorer", "plan outbound campaign" → high

memory_search: [] unless past reference.

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "intent": "primary_intent_classification",
  "goal": "clear_statement_of_what_user_wants_to_achieve",  
  "selected_skill_slug": "exact_slug_of_best_matching_skill_or_null",
  "complexity": "high" | "medium" | "low",
  "memory_search": [],
}`.trim();

// ============================================================================
// PLAN RETRIEVAL NODE
// ============================================================================

/**
 * Plan Retrieval Node
 * 
 * Purpose:
 *   - Fast intent classification from user messages
 *   - Extract actionable goals for planning
 *   - Identify skill and memory search keywords
 * 
 * Design:
 *   - No tool access - pure information extraction
 *   - Low temperature for consistency
 *   - JSON-only response format
 *   - Minimal context requirements
 *   - Fast execution for real-time planning
 */
export class PlanRetrievalNode extends BaseNode {
  constructor() {
    super('plan_retrieval', 'Plan Retrieval');
  }

  private buildSkillsContextForPrompt(availableSkills: SkillSummaryEntry[]): string {
    if (!Array.isArray(availableSkills) || availableSkills.length === 0) {
      return 'No available skills.';
    }

    return availableSkills
      .map((skill) => [
        `${skill.name || 'unknown'}`,
        `slug: ${skill.slug || 'unknown'}`,
        `trigger: ${(Array.isArray(skill.triggers) ? skill.triggers : []).join(' | ') || 'none'}`,
        `description: ${skill.description || ''}`,
      ].join('\n'))
      .join('\n\n');
  }

  async execute(state: BaseThreadState): Promise<NodeResult<BaseThreadState>> {

    // Initialize diagnostics metadata
    const diagnostics: Record<string, any> = {
      skillsLoaded: false,
      skillCount: 0,
      analysisCompleted: false,
      skillArticlesFound: 0,
      memoryArticlesFound: 0,
      vectorSearchFailed: false,
    };

    // ----------------------------------------------------------------
    // 1. LOAD AVAILABLE SKILLS (NO FILTERING - ALLOW PLAN MONITORING)
    // ----------------------------------------------------------------
    const availableSkills = await this.loadAvailableSkills();
    const activePlanCount = await this.getActivePlanCount(state);
    diagnostics.skillsLoaded = true;
    diagnostics.skillCount = availableSkills.length;
    diagnostics.activePlansFound = activePlanCount;

    // ----------------------------------------------------------------
    // 2. FAST-PATH RULE-BASED INTENT DETECTION (with skill checking)
    // ----------------------------------------------------------------
    let planData = this.tryRuleBasedIntentDetection(state, availableSkills);
    
    if (!planData) {
      // ----------------------------------------------------------------
      // 3. FALLBACK TO LLM ANALYSIS FOR COMPLEX CASES
      // ----------------------------------------------------------------
      planData = await this.analyzeUserIntent(state, availableSkills);
      if (!planData) {
        return { state, decision: { type: 'continue' } };
      }
      diagnostics.llmAnalysisUsed = true;
    } else {
      diagnostics.ruleBasedDetection = true;
      console.log('[PlanRetrievalNode] Used fast-path rule-based intent detection - skipped LLM call');
    }
    diagnostics.analysisCompleted = true;

    // ----------------------------------------------------------------
    // 4.5. APPEND SHARED CONTEXT TO GRAPH MESSAGES (POST-ANALYSIS)
    // ----------------------------------------------------------------
    await this.appendSharedContextMessagesToGraphState(state);

    // ----------------------------------------------------------------
    // 5. PERFORM VECTOR DATABASE SEARCHES
    // ----------------------------------------------------------------
    const { memoryArticles } = await this.performVectorSearches(planData);
    diagnostics.skillArticlesFound = 0;
    diagnostics.memoryArticlesFound = memoryArticles.length;

    // ----------------------------------------------------------------
    // 6. STORE RESULTS AND APPEND TOOL MESSAGES
    // ----------------------------------------------------------------
    this.storeMetadata(state, planData);
    await this.appendMemoryResults(state, memoryArticles, planData);

    const wsChannel = String((state.metadata as any).wsChannel || 'chat-controller');
    void this.dispatchToWebSocket(wsChannel, {
      type: 'progress',
      data: {
        phase: 'plan_retrieval',
        selected_skill_slug: planData.selected_skill_slug,
        selectedSkillSlug: planData.selected_skill_slug,
        complexity: planData.complexity,
      },
      timestamp: Date.now(),
    });

    // ----------------------------------------------------------------
    // 7. LOG COMPLETION SUMMARY
    // ----------------------------------------------------------------
    this.logCompletionSummary(planData, memoryArticles);

    // Persist diagnostics on state for downstream inspection
    (state.metadata as any).planRetrieval.diagnostics = diagnostics;

    return { 
      state, 
      decision: { type: 'next' }
    };
  }

  // ======================================================================
  // STEP 1: RULE-BASED FAST-PATH DETECTION
  // ======================================================================

  /**
   * Fast-path rule-based intent detection for simple messages
   * Skips LLM call entirely when conditions are met:
   * - Short message thread (< 10 messages)
   * - Short last user message (< 100 chars)
   * - NO potential skill trigger matches (defers to LLM if skills might apply)
   * - Recognizable patterns (greetings, simple questions)
   */
  private tryRuleBasedIntentDetection(state: BaseThreadState, availableSkills: SkillSummaryEntry[]): PlanRetrievalResponse | null {
    const messages = state.messages;
    const lastUserMessage = this.findLatestUserMessage(messages);
    
    // Bail early if no user message
    if (!lastUserMessage) return null;
    
    const messageContent = typeof lastUserMessage.content === 'string' ? lastUserMessage.content : '';
    const messageLength = messageContent.length;
    const threadLength = messages.length;
    
    // Rule 1: Only apply to small threads and short messages
    if (threadLength > 10 || messageLength > 100) {
      console.log(`[PlanRetrievalNode] Thread too long (${threadLength}) or message too long (${messageLength}) - using LLM`);
      return null;
    }
    
    // Rule 2: Check for potential skill trigger matches - defer to LLM if any found
    if (this.messageMatchesSkillTriggers(messageContent, availableSkills)) {
      console.log('[PlanRetrievalNode] Message potentially matches skill triggers - using LLM for proper analysis');
      return null;
    }
    
    // Rule 3: Check for greeting patterns
    const greetingPatterns = [
      /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i,
      /^(thanks?|thank you|thx)\b/i,
      /^(goodbye|bye|see you|talk later)\b/i
    ];
    
    for (const pattern of greetingPatterns) {
      if (pattern.test(messageContent.trim())) {
        console.log('[PlanRetrievalNode] Detected greeting pattern - using fast-path');
        return {
          intent: 'greeting',
          goal: 'User wants to exchange greetings or pleasantries',
          selected_skill_slug: null,
          complexity: 'low',
          memory_search: [], // No context needed for greetings
        };
      }
    }
    
    // Rule 4: Check for simple question patterns
    const simpleQuestionPatterns = [
      /^(what|how|when|where|why)\s/i,
      /\?\s*$/,
      /^(can you|could you|will you|would you)\s/i
    ];
    
    const isSimpleQuestion = simpleQuestionPatterns.some(pattern => pattern.test(messageContent.trim()));
    if (isSimpleQuestion && messageLength < 50) {
      console.log('[PlanRetrievalNode] Detected simple question pattern - using fast-path');
      return {
        intent: 'simple_question',
        goal: 'User has a brief question or inquiry',
        selected_skill_slug: null,
        complexity: 'low',
        memory_search: [], // Most simple questions don't need context
      };
    }
    
    // Rule 5: Check for status/confirmation patterns
    const statusPatterns = [
      /^(ok|okay|yes|no|sure|fine|alright)\b/i,
      /^(got it|understood|makes sense)\b/i
    ];
    
    for (const pattern of statusPatterns) {
      if (pattern.test(messageContent.trim()) && messageLength < 30) {
        console.log('[PlanRetrievalNode] Detected status/confirmation pattern - using fast-path');
        return {
          intent: 'acknowledgment',
          goal: 'User is acknowledging or confirming something',
          selected_skill_slug: null,
          complexity: 'low',
          memory_search: [], // Acknowledgments rarely need context
        };
      }
    }
    
    // No rule-based detection matched
    console.log(`[PlanRetrievalNode] No rule-based pattern matched for message: "${messageContent.slice(0, 50)}..." - using LLM`);
    return null;
  }

  /**
   * Check if user message potentially matches any skill triggers
   * Returns true if LLM should analyze (potential skill match found)
   * Returns false if safe to proceed with rule-based patterns
   */
  private messageMatchesSkillTriggers(messageContent: string, availableSkills: SkillSummaryEntry[]): boolean {
    if (!Array.isArray(availableSkills) || availableSkills.length === 0) {
      return false;
    }

    const triggerKeywords: string[] = [];
    for (const skill of availableSkills) {
      if (!Array.isArray(skill.triggers)) continue;
      for (const triggerText of skill.triggers) {
        const words = String(triggerText || '').toLowerCase().split(/[,;\s]+/).filter(word => word.length > 2);
        triggerKeywords.push(...words);
      }
    }

    if (triggerKeywords.length === 0) {
      return false;
    }

    const userWords = messageContent.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const messageText = messageContent.toLowerCase();
    
    // Look for exact keyword matches or phrase matches
    for (const trigger of triggerKeywords) {
      if (trigger.length > 15) {
        // Long triggers - check for phrase inclusion
        if (messageText.includes(trigger)) {
          console.log(`[PlanRetrievalNode] Found potential skill trigger phrase match: "${trigger}"`);
          return true;
        }
      } else if (trigger.length > 4) {
        // Medium triggers - check for word matches
        if (userWords.some(word => word.includes(trigger) || trigger.includes(word))) {
          console.log(`[PlanRetrievalNode] Found potential skill trigger word match: "${trigger}"`);
          return true;
        }
      }
      // Skip very short triggers (< 5 chars) to avoid false positives
    }
    
    return false; // No trigger matches found - safe for rule-based patterns
  }

  /**
   * Find the most recent user message in the array
   */
  private findLatestUserMessage(messages: any[]): any | null {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i];
    }
    return null;
  }

  // ======================================================================
  // STEP 2: SKILL LOADING AND ACTIVE PLAN FILTERING
  // ======================================================================

  /**
   * Get count of active plans for diagnostics (no filtering)
   */
  private async getActivePlanCount(state: BaseThreadState): Promise<number> {
    const threadId = (state.metadata as any).threadId;
    const activePlanManager = ActivePlanManager.getInstance();
    
    try {
      const { planSummaries } = await activePlanManager.getActiveSkills(threadId);
      return planSummaries.length;
    } catch (error) {
      console.warn('[PlanRetrievalNode] Failed to get active plan count:', error);
      return 0;
    }
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

    const activeElementsGuidance = [
      '## Active Sidebar Elements (Right Panel)',
      '- The UI supports active elements where the user can watch live webpages/apps and documents as you edit them',
      '- Use tool `manage_active_asset` to create/update/remove these assets at runtime.',
      '- Asset types:',
      '  - iframe: display live webpages/apps (automation tools, workflow UIs, etc).',
      '  - document: display/edit planning docs (for example PRD/planning instructions).',
      '- For workflow SPA websites, use the resolved stable workflow asset id so updates target the same panel.',
      '- Keep iframe URL on the workflow app main/base route only (origin), not deep routes.',
      '- Derive base route dynamically from the provided workflow URL (use URL origin), not hardcoded route paths.',
    ].join('\n');

    environmentContext = `${environmentContext.trim()}\n\n${activeElementsGuidance}`;

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
      console.warn('[PlanRetrievalNode] Failed to read observational memory snapshot:', error);
      return 'Observational memory unavailable due to parse/read error.';
    }
  }

  private async appendSharedContextMessagesToGraphState(state: BaseThreadState): Promise<void> {
    const environmentContextMessage: ChatMessage = {
      role: 'assistant',
      content: `Environment systems and tools context:\n${this.buildEnvironmentContextAssistantMessage()}`,
      metadata: {
        nodeId: this.id,
        nodeName: this.name,
        kind: 'shared_context_environment',
        timestamp: Date.now(),
      },
    };
    const observationalMemoryMessage: ChatMessage = {
      role: 'assistant',
      content: `Observational memory snapshot:\n${await this.getObservationalMemorySnapshot()}`,
      metadata: {
        nodeId: this.id,
        nodeName: this.name,
        kind: 'shared_context_observational_memory',
        timestamp: Date.now(),
      },
    };
    const existingMessages = Array.isArray(state.messages) ? state.messages : [];
    const retainedMessages = existingMessages.filter((message: any) => {
      const metadata = message?.metadata || {};
      const kind = String(metadata?.kind || '').trim();
      return !(
        kind === 'shared_context_environment'
        || kind === 'shared_context_observational_memory'
      );
    });

    state.messages = [
      ...retainedMessages,
      environmentContextMessage,
      observationalMemoryMessage,
    ];

    this.bumpStateVersion(state);
  }

  private async loadAvailableSkills(): Promise<SkillSummaryEntry[]> {
    try {
      const skills = await skillsRegistry.getPlanRetrievalSkillList();
      if (!Array.isArray(skills)) return [];
      return skills;
    } catch (error) {
      console.warn('[PlanRetrievalNode] Failed to load skills from skills registry:', error);
      return [];
    }
  }

  // ======================================================================
  // STEP 2: LLM ANALYSIS
  // ======================================================================

  /**
   * Analyze user intent using LLM with available skills context and active plan awareness
   */
  private async analyzeUserIntent(state: BaseThreadState, availableSkills: SkillSummaryEntry[]): Promise<PlanRetrievalResponse | null> {
    const policy: Required<NodeRunPolicy> = {
      messageSource: 'graph',
      persistAssistantToGraph: false,
      persistToolResultsToGraph: false,
      persistAssistantToNodeState: false,
      persistToolResultsToNodeState: false,
      nodeStateNamespace: '',
      includeGraphAssistantMessages: true,
      includeGraphUserMessages: true,
    };

    const planPrompt = `${PLAN_RETRIEVAL_PROMPT}\n\n## SKILLS CONTEXT\n${this.buildSkillsContextForPrompt(availableSkills)}`;

    console.log(`[PlanRetrievalNode] Analyzing messages for intent and planning data with ${availableSkills.length} available skills`);

    // Use low temperature for consistent extraction
    const extractionResult = await this.chat(
      state,
      planPrompt,
      {
        temperature: 0.1, // Low temperature for consistency
        maxTokens: 500,   // Keep response concise
        format: 'json',   // JSON-only response
        disableTools: true,
        nodeRunPolicy: policy,
      }
    );

    if (!extractionResult) {
      console.warn('[PlanRetrievalNode] No extraction result from LLM');
      return null;
    }

    // Validate and return extraction results
    return this.validatePlanData(extractionResult);
  }

  /**
   * Validate and normalize plan retrieval data - very relaxed extraction
   */
  private validatePlanData(rawData: any): PlanRetrievalResponse {
    // Helper to extract string from any value
    const extractString = (val: any, fallback: string = ''): string => {
      if (typeof val === 'string' && val.trim()) return val.trim();
      if (typeof val === 'object' && val !== null) {
        // Try common object properties
        if (val.value || val.text || val.content || val.description) {
          return extractString(val.value || val.text || val.content || val.description, fallback);
        }
        // Convert object to JSON string if it has meaningful content
        const str = JSON.stringify(val);
        if (str !== '{}' && str !== '[]' && str !== 'null') return str;
      }
      return val ? String(val).trim() : fallback;
    };

    // Helper to extract array of strings from any value
    const extractStringArray = (val: any): string[] => {
      const results: string[] = [];
      
      if (Array.isArray(val)) {
        for (const item of val) {
          const str = extractString(item);
          if (str) results.push(str);
        }
      } else if (typeof val === 'string') {
        // Try splitting by common delimiters
        const splits = val.split(/[,;\n\r]+/).map((s: string) => s.trim()).filter((s: string) => s);
        results.push(...splits);
      } else if (typeof val === 'object' && val !== null) {
        // Extract values from object properties
        for (const key of Object.keys(val)) {
          const str = extractString(val[key]);
          if (str) results.push(str);
        }
      } else if (val) {
        const str = extractString(val);
        if (str) results.push(str);
      }
      
      return results.slice(0, 5); // Allow up to 5 items instead of 3
    };

    const extractComplexity = (val: any): 'high' | 'medium' | 'low' => {
      const normalized = extractString(val, 'medium').toLowerCase();
      if (normalized === 'high' || normalized === 'medium' || normalized === 'low') {
        return normalized;
      }
      return 'medium';
    };

    return {
      intent: extractString(rawData?.intent || rawData?.type || rawData?.category || rawData?.classification, 'general'),
      goal: extractString(rawData?.goal || rawData?.objective || rawData?.target || rawData?.purpose || rawData?.description, 'Process user request'),
      selected_skill_slug: rawData?.selected_skill_slug || null,
      complexity: extractComplexity(rawData?.complexity),
      memory_search: extractStringArray(rawData?.memory_search || rawData?.memories || rawData?.context || rawData?.search_terms),
    };
  }

  // ======================================================================
  // STEP 3: VECTOR DATABASE SEARCHES
  // ======================================================================

  /**
   * Perform vector database searches for skills and memories in parallel with timeout protection
   */
  private async performVectorSearches(planData: PlanRetrievalResponse): Promise<{ memoryArticles: any[] }> {
    console.log('[PlanRetrievalNode] Performing parallel vector database searches with timeout protection');
    
    try {
      // Run both searches in parallel for optimal streaming performance
      const [memoryArticles] = await Promise.allSettled([
        this.searchMemoriesWithTimeout(planData.memory_search)
      ]);
      
      return {
        memoryArticles: memoryArticles.status === 'fulfilled' ? memoryArticles.value : []
      };
      
    } catch (error) {
      console.warn('[PlanRetrievalNode] Vector database search failed:', error);
      // Continue with empty results rather than failing
      return { memoryArticles: [] };
    }
  }

  /**
   * Search for memory articles using extracted keywords with timeout protection
   * Skips database query entirely if no keywords provided (optimizes streaming)
   */
  private async searchMemoriesWithTimeout(memoryKeywords: string[], timeoutMs: number = 4000): Promise<any[]> {
    // Skip database search entirely if no keywords - common for simple/immediate requests
    if (memoryKeywords.length === 0) {
      console.log('[PlanRetrievalNode] No memory search keywords - skipping database query (streaming optimized)');
      return [];
    }

    console.log(`[PlanRetrievalNode] Searching for memories with keywords: ${memoryKeywords.join(', ')}`);
    
    // Add timeout protection for vector search
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Memory search timeout after ${timeoutMs}ms`)), timeoutMs);
    });
    
    try {
      const memoryQuery = memoryKeywords.join(' ');
      const memoryResults = await Promise.race([
        articlesRegistry.search({
          query: memoryQuery,
          limit: 5
        }),
        timeoutPromise
      ]);
      
      const articles = memoryResults.items.map(item => ({
        slug: item.slug,
        title: item.title,
        category: item.category,
        tags: item.tags,
        excerpt: item.excerpt
      }));
      
      console.log(`[PlanRetrievalNode] Found ${articles.length} memory articles`);
      return articles;
    } catch (error) {
      console.warn(`[PlanRetrievalNode] Memory search failed:`, error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  // ======================================================================
  // STEP 4: RESULT STORAGE AND MESSAGE APPENDING
  // ======================================================================

  /**
   * Store essential plan data in state metadata
   */
  private storeMetadata(state: BaseThreadState, planData: PlanRetrievalResponse): void {
    const metadata = state.metadata as any;
    
    metadata.planRetrieval = {
      intent: planData.intent,
      goal: planData.goal,
      selected_skill_slug: planData.selected_skill_slug,
      complexity: planData.complexity,
    };
  }

  /**
   * Append memory results as tool result messages (skill context is appended as assistant message)
   */
  private async appendMemoryResults(state: BaseThreadState, memoryArticles: any[], planData: PlanRetrievalResponse): Promise<void> {
    // Only append memory articles as tool result message.
    if (memoryArticles.length > 0) {
      await this.appendToolResultMessage(state, 'memory_search', {
        toolName: 'memory_search',
        success: true,
        result: {
          articles: memoryArticles,
          count: memoryArticles.length,
          keywords: planData.memory_search
        },
        toolCallId: 'plan_retrieval_memory'
      });
      console.log(`[PlanRetrievalNode] Appended ${memoryArticles.length} memory articles as tool messages`);
    } else {
      console.log('[PlanRetrievalNode] No memory articles to append');
    }
  }

  // ======================================================================
  // STEP 5: COMPLETION LOGGING
  // ======================================================================

  /**
   * Log completion summary with key metrics
   */
  private logCompletionSummary(planData: PlanRetrievalResponse, memoryArticles: any[]): void {
    console.log('[PlanRetrievalNode] Completed plan retrieval with:', {
      intent: planData.intent,
      goal: planData.goal,
      complexity: planData.complexity,
      selectedSkill: planData.selected_skill_slug || null,
      memoryKeywords: planData.memory_search.length,
      memoryArticles: memoryArticles.length,
    });
  }
}
