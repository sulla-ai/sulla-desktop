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
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { articlesRegistry, type ArticleListItem } from '../database/registry/ArticlesRegistry';
import { redisClient } from '../database/RedisClient';
import { ActivePlanManager } from './ActivePlanManager';

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

// ============================================================================
// PLAN RETRIEVAL PROMPT
// ============================================================================

const PLAN_RETRIEVAL_PROMPT = `You are a specialized planning and intent analysis system. Your job is to extract structured data from user messages and select the most appropriate skill for execution.

Look at the users last message, think critically, think how would you handle the inquiry?

{{active_plans_context}}

## Available Skills in Knowledge Base

{{skills}}

## Selection Guidelines
- selected_skill_slug: exact slug ONLY if a skill trigger matches perfectly. Null for everything else (general chat, info requests, tool use).
- memory_search: 1-3 keywords ONLY for historical references ("remember", "last time", "my previous", stored data). Empty [] otherwise.

## Complexity Classification (strict order - follow exactly)
1. Skill trigger matches? → selected_skill_slug = slug, complexity = "high"
2. Else, requires ANY tool (web_search, browse_page, code_execution, API call, live data fetch) or info not in current context? → complexity = "medium"
3. Else → complexity = "low"

Examples:
- "how are you" → low
- "check this API", "browse example.com", "current FB ad costs" → medium
- "build lead scorer", "plan outbound campaign", "create workflow" → high

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "intent": "primary_intent_classification",
  "goal": "clear_statement_of_what_user_wants_to_achieve",  
  "selected_skill_slug": "exact_slug_of_best_matching_skill_or_null",
  "complexity": "high" | "medium" | "low",
  "memory_search": [],
}

## Selection Guidelines
- selected_skill_slug: exact slug ONLY if a skill trigger matches perfectly. Null for everything else (general chat, info requests, tool use).
- memory_search: 1-3 keywords ONLY for historical references ("remember", "last time", "my previous", stored data). Empty [] otherwise.

## Complexity Classification (strict order - follow exactly)
1. Skill trigger matches? → selected_skill_slug = slug, complexity = "high"
2. Else, requires ANY tool (web_search, browse_page, code_execution, API call, live data fetch) or info not in current context? → complexity = "medium"
3. Else → complexity = "low"

Examples:
- "how are you" → low
- "check this API", "browse example.com", "current FB ad costs" → medium
- "build lead scorer", "plan outbound campaign", "create workflow" → high

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

  async execute(state: BaseThreadState): Promise<NodeResult<BaseThreadState>> {

    // Initialize diagnostics metadata
    const diagnostics: Record<string, any> = {
      skillsLoaded: false,
      analysisCompleted: false,
      skillArticlesFound: 0,
      memoryArticlesFound: 0,
      vectorSearchFailed: false,
    };

    // ----------------------------------------------------------------
    // 1. LOAD AVAILABLE SKILLS (NO FILTERING - ALLOW PLAN MONITORING)
    // ----------------------------------------------------------------
    const availableSkills = await this.loadSkillTriggers();
    const activePlanCount = await this.getActivePlanCount(state);
    diagnostics.skillsLoaded = true;
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
    // 4. PERFORM VECTOR DATABASE SEARCHES
    // ----------------------------------------------------------------
    const { skillArticles, memoryArticles } = await this.performVectorSearches(planData);
    diagnostics.skillArticlesFound = skillArticles.length;
    diagnostics.memoryArticlesFound = memoryArticles.length;

    // ----------------------------------------------------------------
    // 5. STORE RESULTS AND APPEND TOOL MESSAGES
    // ----------------------------------------------------------------
    this.storeMetadata(state, planData);
    await this.appendSelectedSkillMessage(state, skillArticles);
    await this.appendMemoryResults(state, memoryArticles, planData);

    // ----------------------------------------------------------------
    // 6. LOG COMPLETION SUMMARY
    // ----------------------------------------------------------------
    this.logCompletionSummary(planData, skillArticles, memoryArticles);

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
  private tryRuleBasedIntentDetection(state: BaseThreadState, availableSkills: string): PlanRetrievalResponse | null {
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
  private messageMatchesSkillTriggers(messageContent: string, availableSkills: string): boolean {
    // If no skills available, no match possible
    if (!availableSkills || availableSkills.includes('_No skills found')) {
      return false;
    }
    
    // Extract trigger phrases from skill list (look for "Trigger:" lines)
    const triggerMatches = availableSkills.match(/Trigger:\s*([^\n]+)/gi);
    if (!triggerMatches || triggerMatches.length === 0) {
      return false; // No triggers found in skills
    }
    
    // Extract trigger keywords/phrases
    const triggerKeywords: string[] = [];
    for (const match of triggerMatches) {
      const triggerText = match.replace(/Trigger:\s*/i, '').toLowerCase().trim();
      // Split on common delimiters and extract meaningful terms
      const words = triggerText.split(/[,;\s]+/).filter(word => word.length > 2);
      triggerKeywords.push(...words);
    }
    
    if (triggerKeywords.length === 0) {
      return false; // No meaningful trigger keywords found
    }
    
    // Check user message for trigger keyword matches
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

  /**
   * Load skill triggers with cache-first approach and background refresh.
   * Never blocks streaming - returns cached data immediately, then refreshes in background if stale.
   */
  private async loadSkillTriggers(): Promise<string> {
    const cacheKey = 'sulla:skills:triggers';
    const cacheTimestampKey = 'sulla:skills:triggers:timestamp';
    const cacheTTL = 3600; // 1 hour in seconds
    
    let cachedData: string | null = null;
    let cacheTimestamp: number = 0;
    
    // Step 1: Always try to get cached data first
    try {
      await redisClient.initialize();
      cachedData = await redisClient.get(cacheKey);
      const timestampStr = await redisClient.get(cacheTimestampKey);
      cacheTimestamp = timestampStr ? parseInt(timestampStr, 10) : 0;
    } catch (error) {
      console.warn('[PlanRetrievalNode] Redis cache read failed:', error);
    }
    
    const now = Math.floor(Date.now() / 1000);
    const cacheAge = now - cacheTimestamp;
    const isCacheStale = cacheAge > cacheTTL;
    const hasPoisonedCache = !!cachedData && (
      cachedData.includes('_No skills found in the knowledge base yet._') ||
      cachedData.includes('_Failed to load skills from the knowledge base._')
    );
    
    // Step 2: If we have cached data, return it immediately
    if (cachedData && !hasPoisonedCache) {
      console.log(`[PlanRetrievalNode] Retrieved skill triggers from cache (age: ${cacheAge}s)`);
      
      // Step 3: If cache is stale, trigger background refresh for next request
      if (isCacheStale) {
        console.log('[PlanRetrievalNode] Cache is stale, triggering background refresh');
        this.refreshSkillTriggersInBackground(cacheKey, cacheTimestampKey).catch(err => {
          console.warn('[PlanRetrievalNode] Background skill refresh failed:', err);
        });
      }
      
      return cachedData;
    }

    // If cache exists but only contains a negative/error sentinel, refresh immediately.
    if (hasPoisonedCache) {
      console.log('[PlanRetrievalNode] Cached skill triggers contain sentinel result; forcing synchronous refresh');
    }
    
    // Step 4: No cache exists - we need to load synchronously (first time only)
    console.log('[PlanRetrievalNode] No cache found, loading skills synchronously (first time)');
    return this.loadSkillTriggersFromDatabase(cacheKey, cacheTimestampKey);
  }

  /**
   * Background refresh of skill triggers cache (non-blocking)
   */
  private async refreshSkillTriggersInBackground(cacheKey: string, timestampKey: string): Promise<void> {
    try {
      const freshData = await this.loadSkillTriggersFromDatabase(cacheKey, timestampKey);
      console.log('[PlanRetrievalNode] Background refresh completed successfully');
    } catch (error) {
      console.warn('[PlanRetrievalNode] Background refresh failed:', error);
    }
  }

  /**
   * Load skill triggers from database and update cache
   */
  private async loadSkillTriggersFromDatabase(cacheKey: string, timestampKey: string): Promise<string> {
    let result: string;
    
    try {
      const { Article } = await import('../database/models/Article');
      const articles = await Article.findByTag('skill');

      if (!articles || articles.length === 0) {
        result = '_No skills found in the knowledge base yet._';
        console.log('[PlanRetrievalNode] No skills found in database');
      } else {
        const lines: string[] = [];
        const seenSlugs = new Set<string>();

        for (const article of articles) {
          const slug = article.attributes.slug || 'unknown';
          if (seenSlugs.has(slug)) {
            continue; // Skip duplicates
          }
          seenSlugs.add(slug);

          const title = article.attributes.title || slug;
          const doc = article.attributes.document || '';

          const trigger = this.extractSkillTrigger(doc);

          // Only include true skills that define an actual trigger
          if (!trigger || /^no\s+trigger\s+defined$/i.test(trigger)) {
            continue;
          }

          lines.push(`- **${title}** (slug: \`${slug}\`)\n  Trigger: ${trigger}`);
        }

        result = lines.length > 0
          ? lines.join('\n')
          : '_No skills found in the knowledge base yet._';
        console.log(`[PlanRetrievalNode] Loaded ${lines.length} triggered skills from ${articles.length} skill-tagged articles`);
      }
    } catch (error) {
      console.warn('[PlanRetrievalNode] Failed to load skill triggers from database:', error);
      result = '_Failed to load skills from the knowledge base._';
    }

    // ALWAYS cache the result - whether skills exist, don't exist, or failed to load
    // This ensures streaming never waits for database queries
    const timestamp = Math.floor(Date.now() / 1000);
    try {
      await redisClient.set(cacheKey, result);
      await redisClient.set(timestampKey, timestamp.toString());
      console.log('[PlanRetrievalNode] Cached skill triggers result (ensures no future blocking)');
    } catch (error) {
      console.warn('[PlanRetrievalNode] Redis cache write failed:', error);
    }

    return result;
  }

  private extractSkillTrigger(document: string): string {
    const doc = String(document || '');

    // 1) Canonical markdown format: **Trigger**: ...
    let match = doc.match(/\*\*Trigger\*\*\s*:\s*(.+)/i);
    if (match?.[1]) {
      return match[1].trim().replace(/^['"]|['"]$/g, '');
    }

    // 2) Plain text format: Trigger: ...
    match = doc.match(/(?:^|\n)\s*Trigger\s*:\s*(.+)/i);
    if (match?.[1]) {
      return match[1].trim().replace(/^['"]|['"]$/g, '');
    }

    // 3) Frontmatter format:
    // ---
    // trigger: ...
    // ---
    const fm = doc.match(/^---\s*\n([\s\S]*?)\n---/);
    if (fm?.[1]) {
      const triggerLine = fm[1].match(/(?:^|\n)\s*trigger\s*:\s*(.+)/i);
      if (triggerLine?.[1]) {
        return triggerLine[1].trim().replace(/^['"]|['"]$/g, '');
      }
    }

    return '';
  }

  // ======================================================================
  // STEP 2: LLM ANALYSIS
  // ======================================================================

  /**
   * Analyze user intent using LLM with available skills context and active plan awareness
   */
  private async analyzeUserIntent(state: BaseThreadState, availableSkills: string): Promise<PlanRetrievalResponse | null> {
    // Get active plans context
    const threadId = (state.metadata as any).threadId;
    const activePlanManager = ActivePlanManager.getInstance();
    const activePlanSummary = await activePlanManager.getActivePlanSummary(threadId);
    
    // Build active plans context for plan status awareness
    let activePlansContext = '';
    if (activePlanSummary !== 'No active plans currently running.') {
      activePlansContext = `## Currently Active Plans\n${activePlanSummary}\n\n**Plan Selection Options**:\n- Select a DIFFERENT skill if you want to start a new parallel plan\n- Select the SAME skill as an active plan if you want to monitor/check status of that existing plan\n- All skills remain available - choose based on user intent`;
    } else {
      activePlansContext = `## Currently Active Plans\nNo active plans currently running - all skills are available for new plans.`;
    }
    
    // Replace placeholders with actual data
    const analysisPrompt = PLAN_RETRIEVAL_PROMPT
      .replace('{{skills}}', availableSkills)
      .replace('{{active_plans_context}}', activePlansContext);

    console.log('[PlanRetrievalNode] Analyzing messages for intent and planning data with available skills');

    // Use low temperature for consistent extraction
    const extractionResult = await this.chat(
      state,
      analysisPrompt,
      {
        temperature: 0.1, // Low temperature for consistency
        maxTokens: 500,   // Keep response concise
        format: 'json',   // JSON-only response
        disableTools: true // No tools needed for intent analysis
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
  private async performVectorSearches(planData: PlanRetrievalResponse): Promise<{skillArticles: any[], memoryArticles: any[]}> {
    console.log('[PlanRetrievalNode] Performing parallel vector database searches with timeout protection');
    
    try {
      // Run both searches in parallel for optimal streaming performance
      const [skillArticles, memoryArticles] = await Promise.allSettled([
        this.loadSelectedSkillWithTimeout(planData.selected_skill_slug),
        this.searchMemoriesWithTimeout(planData.memory_search)
      ]);
      
      return {
        skillArticles: skillArticles.status === 'fulfilled' ? skillArticles.value : [],
        memoryArticles: memoryArticles.status === 'fulfilled' ? memoryArticles.value : []
      };
      
    } catch (error) {
      console.warn('[PlanRetrievalNode] Vector database search failed:', error);
      // Continue with empty results rather than failing
      return { skillArticles: [], memoryArticles: [] };
    }
  }

  /**
   * Load a specific skill by slug if selected (with timeout protection)
   */
  private async loadSelectedSkillWithTimeout(skillSlug: string | null, timeoutMs: number = 3000): Promise<any[]> {
    if (!skillSlug) {
      console.log('[PlanRetrievalNode] No skill selected - using memory search for general assistance');
      return [];
    }

    console.log(`[PlanRetrievalNode] Loading selected skill: ${skillSlug}`);
    
    // Add timeout protection for database query
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Skill loading timeout after ${timeoutMs}ms`)), timeoutMs);
    });
    
    try {
      const selectedSkill = await Promise.race([
        articlesRegistry.getBySlug(skillSlug),
        timeoutPromise
      ]);
      
      if (selectedSkill) {
        console.log(`[PlanRetrievalNode] Successfully loaded selected skill: ${skillSlug}`);
        return [{
          slug: selectedSkill.slug,
          title: selectedSkill.title,
          category: selectedSkill.category,
          tags: selectedSkill.tags,
          excerpt: selectedSkill.excerpt,
          document: selectedSkill.document
        }];
      } else {
        console.warn(`[PlanRetrievalNode] Selected skill not found: ${skillSlug}`);
        return [];
      }
    } catch (error) {
      console.warn(`[PlanRetrievalNode] Failed to load skill ${skillSlug}:`, error instanceof Error ? error.message : String(error));
      return [];
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

  private async appendSelectedSkillMessage(state: BaseThreadState, skillArticles: any[]): Promise<void> {
    if (skillArticles.length === 0) {
      console.log('[PlanRetrievalNode] No selected skill to append as assistant message');
      return;
    }

    const skill = skillArticles[0];
    const payload = {
      slug: skill.slug,
      title: skill.title,
      excerpt: skill.excerpt || '',
      document: skill.document || '',
      category: skill.category || '',
      tags: Array.isArray(skill.tags) ? skill.tags : [],
      selectedAt: Date.now(),
    };

    await this.appendResponse(state, `PLAN_RETRIEVAL_SKILL_CONTEXT\n${JSON.stringify(payload)}`);
    console.log(`[PlanRetrievalNode] Appended selected skill context as assistant message: ${skill.slug}`);
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
  private logCompletionSummary(planData: PlanRetrievalResponse, skillArticles: any[], memoryArticles: any[]): void {
    console.log('[PlanRetrievalNode] Completed plan retrieval with:', {
      intent: planData.intent,
      goal: planData.goal,
      selectedSkill: skillArticles.length > 0 ? skillArticles[0].slug : null,
      memoryKeywords: planData.memory_search.length,
      memoryArticles: memoryArticles.length,
    });
  }
}
