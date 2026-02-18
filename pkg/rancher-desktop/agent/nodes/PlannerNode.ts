import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { BaseThreadState, NodeResult } from './Graph';
import { ActivePlanManager } from './ActivePlanManager';

// Types for planner responses
interface PlannerResponse {
  restated_goal: string;
  plan_steps: string[];
  complexity_score: number;
  complexity_reasoning: string;
  skill_focused: boolean;
  estimated_duration: string;
  inheritedState?: any; // For plan takeovers
  takeoverMetadata?: {
    originalExecutor: string;
    takeoverTimestamp: number;
    takeoverReason: string;
    originalPlanId: string;
    stallDuration: number;
  };
}

// Planner prompt template
const PLANNER_PROMPT = `You are a {{planning_mode}} AI that {{planning_action}} based on user goals.

## Context
User Goal: {{goal}}
{{skill_context}}

## Your Task
1. **Restate the Goal**: Clearly articulate what the user wants to achieve
2. **{{task_type}}**: {{task_description}}
3. **Assess Complexity**: Rate complexity 1-10 and explain reasoning
4. **Estimate Duration**: Provide realistic time estimate

{{planning_instructions}}

## Response Format
${JSON_ONLY_RESPONSE_INSTRUCTIONS}

{
  "restated_goal": "Clear restatement of the user's objective",
  "plan_steps": [
    "Step 1: Specific actionable item",
    "Step 2: Next logical step",
    "Step 3: Continue until goal achieved"
  ],
  "complexity_score": 5,
  "complexity_reasoning": "Explanation of complexity factors",
  "skill_focused": true/false,
  "estimated_duration": "2-4 hours"
}

{{focus_instruction}}`;

const SKILL_FOCUSED_INSTRUCTIONS = `## Planning Instructions - SOP Compliance
A specific skill SOP has been selected for this task: **{{skill_title}}**

**FOLLOW THIS EXACT SOP - DO NOT DEVIATE FROM THE PRESCRIBED STEPS UNLESS EXPLICITLY OVERRIDDEN BY USER INSTRUCTIONS**

Your task is SOP compliance, not general planning:
- Follow the exact steps provided in this SOP
- Execute the prescribed methodology precisely as outlined
- Maintain the sequence and dependencies as specified
- Only modify steps if user instructions explicitly contradict this SOP
- This is a standard operating procedure - execute it as prescribed

This is not a general plan - this is SOP execution.`;

const GENERAL_PLANNING_INSTRUCTIONS = `## Planning Instructions - General Approach
No specific skill was selected, so create a comprehensive general plan:
- Analyze the goal from first principles
- Consider multiple approaches and methodologies
- Break down complex tasks into manageable steps
- Account for common challenges and prerequisites`;

/**
 * Planner Node
 * 
 * Purpose:
 *   - Generate actionable plans based on user goals
 *   - Restate goals clearly for confirmation
 *   - Assess plan complexity and duration
 *   - Adapt planning approach based on selected skills
 * 
 * Design:
 *   - Controller pattern with organized private methods
 *   - Skill-aware prompting for focused planning
 *   - Complexity scoring for resource estimation
 *   - Always returns a plan (never fails)
 *   - Streaming optimized with tool disabling
 */
export class PlannerNode extends BaseNode {
  constructor() {
    super('planner', 'Planner');
  }

  async execute(state: BaseThreadState): Promise<NodeResult<BaseThreadState>> {

    // Initialize diagnostics metadata
    const diagnostics: Record<string, any> = {
      goalExtracted: false,
      skillDetected: false,
      planGenerated: false,
      complexityScored: false,
      planStepsCount: 0
    };

    // ----------------------------------------------------------------
    // 1. EXTRACT GOAL AND SKILL CONTEXT FROM STATE
    // ----------------------------------------------------------------
    const { goal, selectedSkill } = this.extractPlanningContext(state);
    diagnostics.goalExtracted = !!goal;
    diagnostics.skillDetected = !!selectedSkill;

    // ----------------------------------------------------------------
    // 2. CHECK FOR EXISTING PLAN OR GENERATE NEW ONE
    // ----------------------------------------------------------------
    const existingPlan = await this.checkForExistingPlan(state, selectedSkill);
    
    let planData: PlannerResponse;
    
    if (existingPlan) {
      // Join or monitor existing plan
      planData = await this.handleExistingPlan(state, existingPlan, goal);
      diagnostics.joinedExistingPlan = true;
      diagnostics.planGenerated = true;
      diagnostics.planStepsCount = planData.plan_steps.length;
    } else {
      // Generate new plan
      const newPlanData = await this.generateActionPlan(state, goal, selectedSkill);
      if (!newPlanData) {
        // Fallback plan generation - never fail completely
        const fallbackPlan = this.createFallbackPlan(goal);
        this.storePlanInState(state, fallbackPlan);
        planData = fallbackPlan;
        diagnostics.planGenerated = true;
        diagnostics.planStepsCount = fallbackPlan.plan_steps.length;
      } else {
        this.storePlanInState(state, newPlanData);
        await this.registerActivePlan(state, newPlanData);
        planData = newPlanData;
        diagnostics.planGenerated = true;
        diagnostics.complexityScored = true;
        diagnostics.planStepsCount = newPlanData.plan_steps.length;
      }
    }

    // ----------------------------------------------------------------
    // 3. APPEND PLAN SUMMARY TO CONVERSATION
    // ----------------------------------------------------------------
    await this.appendPlanSummary(state, planData || this.createFallbackPlan(goal));

    // ----------------------------------------------------------------
    // 4. LOG COMPLETION SUMMARY
    // ----------------------------------------------------------------
    this.logPlannerCompletion(planData || this.createFallbackPlan(goal));

    // Persist plan data and diagnostics for downstream inspection
    (state.metadata as any).planner = { 
      ...((state.metadata as any).planner || {}),
      ...planData, // Store actual plan data including plan_steps
      diagnostics 
    };

    return { 
      state, 
      decision: { type: 'next' }
    };
  }

  // ======================================================================
  // STEP 1: CONTEXT EXTRACTION
  // ======================================================================

  /**
   * Extract goal and skill context from PlanRetrievalNode results
   */
  private extractPlanningContext(state: BaseThreadState): { goal: string; selectedSkill: any | null } {
    const planRetrieval = (state.metadata as any).planRetrieval || {};
    
    // Extract goal from plan retrieval
    const goal = planRetrieval.goal || 
                 planRetrieval.intent || 
                 'Complete the requested task';

    // Get skill data directly from state metadata (not from tool messages)
    const selectedSkill = planRetrieval.skillData || null;

    console.log(`[PlannerNode] Extracted context - Goal: "${goal}", Skill: ${selectedSkill ? selectedSkill.title : 'None'}`);
    
    return { goal, selectedSkill };
  }

  // ======================================================================
  // STEP 2: PLAN GENERATION
  // ======================================================================

  /**
   * Generate comprehensive action plan using LLM with skill-aware prompting
   */
  private async generateActionPlan(
    state: BaseThreadState, 
    goal: string, 
    selectedSkill: any | null
  ): Promise<PlannerResponse | null> {
    
    // Build context and instructions based on skill selection
    let skillContext = '';
    let planningInstructions = '';
    let planningMode = '';
    let planningAction = '';
    let taskType = '';
    let taskDescription = '';
    let focusInstruction = '';
    
    if (selectedSkill) {
      // SOP-focused approach when skill is selected
      skillContext = `
**SELECTED SOP SKILL: ${selectedSkill.title}**
SOP Description: ${selectedSkill.excerpt || 'No description available'}

**COMPLETE SOP DOCUMENT:**
${selectedSkill.document || 'No SOP content available'}`;
      
      planningInstructions = SKILL_FOCUSED_INSTRUCTIONS.replace('{{skill_title}}', selectedSkill.title);
      planningMode = 'SOP Compliance';
      planningAction = 'executes Standard Operating Procedures (SOPs)';
      taskType = 'Execute SOP Steps';
      taskDescription = 'Extract and execute the exact steps from the selected SOP skill document';
      focusInstruction = 'This is SOP execution - follow the prescribed steps precisely unless user instructions explicitly override the SOP.';
    } else {
      // General planning approach when no skill selected
      skillContext = 'No specific SOP skill selected - using general planning approach.';
      planningInstructions = GENERAL_PLANNING_INSTRUCTIONS;
      planningMode = 'strategic planning';
      planningAction = 'creates actionable plans';
      taskType = 'Create Action Plan';
      taskDescription = 'Break down the goal into specific, actionable steps';
      focusInstruction = 'Focus on creating a practical, executable plan that moves the user toward their goal efficiently.';
    }

    // Prepare prompt with all context variables
    const planningPrompt = PLANNER_PROMPT
      .replace('{{goal}}', goal)
      .replace('{{skill_context}}', skillContext)
      .replace('{{planning_instructions}}', planningInstructions)
      .replace('{{planning_mode}}', planningMode)
      .replace('{{planning_action}}', planningAction)
      .replace('{{task_type}}', taskType)
      .replace('{{task_description}}', taskDescription)
      .replace('{{focus_instruction}}', focusInstruction);

    console.log(`[PlannerNode] Generating plan for goal: "${goal}" ${selectedSkill ? `with skill: ${selectedSkill.title}` : 'without specific skill'}`);

    // Generate plan with LLM
    const planResult = await this.chat(
      state,
      planningPrompt,
      {
        temperature: 0.2, // Slightly creative but consistent
        maxTokens: 800,   // Allow for detailed plans
        format: 'json',   // JSON-only response
        disableTools: true // No tools needed for planning
      }
    );

    if (!planResult) {
      console.warn('[PlannerNode] No plan result from LLM - using fallback');
      return null;
    }

    // Validate and return plan data
    return this.validatePlanData(planResult);
  }

  /**
   * Validate and normalize plan data from LLM response
   */
  private validatePlanData(rawData: any): PlannerResponse | null {
    try {
      const data = typeof rawData.content === 'string' ? JSON.parse(rawData.content) : rawData.content;
      
      // Validate required fields
      const restated_goal = data.restated_goal || data.goal || 'Complete the requested task';
      const plan_steps = Array.isArray(data.plan_steps) ? data.plan_steps : ['Analyze requirements', 'Execute task'];
      const complexity_score = Math.max(1, Math.min(10, parseInt(data.complexity_score) || 5));
      const complexity_reasoning = data.complexity_reasoning || 'Standard complexity assessment';
      const skill_focused = Boolean(data.skill_focused);
      const estimated_duration = data.estimated_duration || 'Time estimate unavailable';

      return {
        restated_goal,
        plan_steps,
        complexity_score,
        complexity_reasoning,
        skill_focused,
        estimated_duration
      };
    } catch (error) {
      console.warn('[PlannerNode] Failed to validate plan data:', error);
      return null;
    }
  }

  /**
   * Create fallback plan when LLM generation fails
   */
  private createFallbackPlan(goal: string): PlannerResponse {
    return {
      restated_goal: goal || 'Complete the user\'s request',
      plan_steps: [
        'Analyze the requirements and context',
        'Break down the task into manageable components', 
        'Execute each component systematically',
        'Review and refine the results',
        'Deliver the completed outcome'
      ],
      complexity_score: 5,
      complexity_reasoning: 'Fallback complexity estimate - moderate difficulty assumed',
      skill_focused: false,
      estimated_duration: '1-3 hours'
    };
  }

  // ======================================================================
  // STEP 3: PLAN STORAGE AND MESSAGING
  // ======================================================================

  /**
   * Store plan data via Redis-backed message system for serverless handoff
   * Plans persist through conversation messages, not ephemeral state
   */
  private storePlanInState(state: BaseThreadState, planData: PlannerResponse): void {
    // Store minimal plan reference for downstream nodes within same instance
    const planReference = {
      planId: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      goal: planData.restated_goal,
      stepsCount: planData.plan_steps.length,
      complexity: planData.complexity_score,
      handoffViaMessages: true // Flag indicating plan is in messages, not state
    };

    // Store minimal reference in instance memory (not Redis state)
    (state as any).__currentPlanReference = planReference;

    console.log(`[PlannerNode] Plan stored via message handoff system (ID: ${planReference.planId})`);
    console.log(`[PlannerNode] Plan data flows through Redis-backed conversation messages`);
  }

  /**
   * Check if an existing plan is already running for the selected skill
   */
  private async checkForExistingPlan(state: BaseThreadState, selectedSkill: any | null): Promise<any | null> {
    if (!selectedSkill) {
      return null; // No skill selected, no existing plan to check
    }

    const threadId = (state.metadata as any).threadId;
    const activePlanManager = ActivePlanManager.getInstance();

    try {
      const activePlans = await activePlanManager.getActivePlans(threadId);
      
      // Look for existing plan using the same skill
      const existingPlan = activePlans.find(plan => 
        plan.skillSlug === selectedSkill.slug && 
        (plan.status === 'planning' || plan.status === 'executing' || plan.status === 'paused')
      );

      if (existingPlan) {
        console.log(`[PlannerNode] Found existing plan for skill ${selectedSkill.title}`);
        console.log(`[PlannerNode] Plan ID: ${existingPlan.planId}, Status: ${existingPlan.status}`);
        console.log(`[PlannerNode] Executor PID: ${existingPlan.executorPID}`);
        
        const timeSinceHeartbeat = Date.now() - existingPlan.lastHeartbeat;
        console.log(`[PlannerNode] Time since last heartbeat: ${Math.floor(timeSinceHeartbeat / 1000)}s`);
      }

      return existingPlan || null;
    } catch (error) {
      console.warn('[PlannerNode] Failed to check for existing plans:', error);
      return null;
    }
  }

  /**
   * Handle existing plan using 3-strike system
   */
  private async handleExistingPlan(state: BaseThreadState, existingPlan: any, userGoal: string): Promise<PlannerResponse> {
    const skillData = (state.metadata as any).planRetrieval?.skillData;
    const skillTitle = skillData?.title || 'Unknown Skill';
    const activePlanManager = ActivePlanManager.getInstance();
    
    // 3-STRIKE ASSESSMENT
    if (this.isPlanHealthy(existingPlan)) {
      // STRIKE 1: Plan is healthy - STOP FLOW
      return this.createHealthyPlanResponse(existingPlan, skillTitle);
    } 
    else if (this.isPlanUnhealthy(existingPlan)) {
      // STRIKE 2: Plan is unhealthy - MARK AS PAUSED
      await activePlanManager.updatePlanStatus(
        existingPlan.threadId, 
        existingPlan.planId, 
        existingPlan.executorPID, 
        'paused'
      );
      return this.createUnhealthyPlanResponse(existingPlan, skillTitle);
    }
    else if (this.isPlanStale(existingPlan)) {
      // STRIKE 3: Plan is stale - EXECUTE TAKEOVER
      return await this.executePlanTakeover(state, existingPlan, userGoal, skillTitle);
    }
    
    // Fallback - treat as monitoring
    return this.createMonitoringPlanResponse(existingPlan, skillTitle);
  }

  /**
   * Check if plan is healthy (Strike 1)
   */
  private isPlanHealthy(plan: any): boolean {
    const timeSinceHeartbeat = Date.now() - plan.lastHeartbeat;
    return (
      timeSinceHeartbeat < 60000 && // Less than 60 seconds
      (plan.status === 'planning' || plan.status === 'executing') &&
      plan.executorPID && // Has executor
      !plan.takeoverAllowed
    );
  }

  /**
   * Check if plan is unhealthy (Strike 2)  
   */
  private isPlanUnhealthy(plan: any): boolean {
    const timeSinceHeartbeat = Date.now() - plan.lastHeartbeat;
    return (
      timeSinceHeartbeat >= 60000 && // 60-120 seconds
      timeSinceHeartbeat < 120000 &&
      plan.status === 'executing' &&
      !plan.takeoverAllowed
    );
  }

  /**
   * Check if plan is stale (Strike 3)
   */
  private isPlanStale(plan: any): boolean {
    const timeSinceHeartbeat = Date.now() - plan.lastHeartbeat;
    return (
      timeSinceHeartbeat >= 120000 || // Over 120 seconds
      plan.status === 'paused' ||
      plan.takeoverAllowed === true
    );
  }

  /**
   * Create response for healthy plan (Strike 1) - STOP FLOW
   */
  private createHealthyPlanResponse(plan: any, skillTitle: string): PlannerResponse {
    const timeSinceHeartbeat = Date.now() - plan.lastHeartbeat;
    const secondsAgo = Math.floor(timeSinceHeartbeat / 1000);

    return {
      restated_goal: `${skillTitle} plan is actively running`,
      plan_steps: [
        `✅ Plan Status: HEALTHY and ACTIVE`,
        `📋 Current Goal: ${plan.goal}`,
        `⚡ Last Activity: ${secondsAgo} seconds ago`,
        `🎯 Executor: ${plan.executorPID}`,
        `⏱️ Started: ${new Date(plan.startedAt).toLocaleTimeString()}`,
        `🔄 This plan is progressing normally`,
        `⏹️ No action needed - stopping flow to avoid duplication`
      ],
      complexity_score: 1,
      complexity_reasoning: 'Simple status check - plan is healthy',
      skill_focused: true,
      estimated_duration: '30 seconds'
    };
  }

  /**
   * Create response for unhealthy plan (Strike 2) - PAUSE AND MONITOR
   */
  private createUnhealthyPlanResponse(plan: any, skillTitle: string): PlannerResponse {
    const timeSinceHeartbeat = Date.now() - plan.lastHeartbeat;
    const secondsAgo = Math.floor(timeSinceHeartbeat / 1000);

    return {
      restated_goal: `${skillTitle} plan marked as unhealthy`,
      plan_steps: [
        `⚠️ Plan Status: UNHEALTHY - No recent activity`,
        `📋 Stalled Goal: ${plan.goal}`,
        `⏰ Silent for: ${secondsAgo} seconds`,
        `🔴 Executor: ${plan.executorPID} (not responding)`,
        `⏸️ Plan marked as PAUSED for monitoring`,
        `🔍 Next attempt will trigger takeover if still stalled`,
        `⏹️ Monitoring initiated - stopping flow`
      ],
      complexity_score: 2,
      complexity_reasoning: 'Plan health assessment and pause action',
      skill_focused: true,
      estimated_duration: '1 minute'
    };
  }

  /**
   * Register active plan with ActivePlanManager to prevent duplicates
   */
  private async registerActivePlan(state: BaseThreadState, planData: PlannerResponse): Promise<void> {
    const threadId = (state.metadata as any).threadId;
    const planReference = (state as any).__currentPlanReference;
    const planId = planReference ? planReference.planId : `plan_${Date.now()}`;
    
    // Extract skill information if plan is skill-focused
    let skillSlug: string | null = null;
    let skillTitle: string | null = null;
    
    if (planData.skill_focused) {
      const planRetrieval = (state.metadata as any).planRetrieval || {};
      const skillData = planRetrieval.skillData;
      if (skillData) {
        skillSlug = skillData.slug;
        skillTitle = skillData.title;
      }
    }
    
    const activePlanManager = ActivePlanManager.getInstance();
    
    try {
      await activePlanManager.registerActivePlan(
        threadId,
        planId,
        planData.restated_goal,
        skillSlug,
        skillTitle
      );
      
      console.log(`[PlannerNode] Registered active plan with ActivePlanManager`);
      console.log(`[PlannerNode] Plan ID: ${planId}`);
      console.log(`[PlannerNode] Skill: ${skillTitle || 'General Planning'}`);
    } catch (error) {
      console.warn('[PlannerNode] Failed to register active plan:', error);
    }
  }

  /**
   * Append plan as structured message for serverless handoff and user visibility
   * This message carries the complete plan data across Redis-backed instances
   */
  private async appendPlanSummary(state: BaseThreadState, planData: PlannerResponse): Promise<void> {
    const stepsText = planData.plan_steps
      .map((step, index) => `${index + 1}. ${step}`)
      .join('\n');

    // Create user-visible plan summary
    const userPlanSummary = `## 📋 Action Plan Created

**Goal**: ${planData.restated_goal}

**Plan Steps**:
${stepsText}

**Complexity**: ${planData.complexity_score}/10 - ${planData.complexity_reasoning}
**Estimated Duration**: ${planData.estimated_duration}
${planData.skill_focused ? '**Approach**: SOP-focused execution' : '**Approach**: General planning'}

Ready to proceed with execution!`;

    // Append user-visible message
    state.messages.push({
      role: 'assistant',
      content: userPlanSummary
    });

    // Get plan ID from current plan reference
    const planReference = (state as any).__currentPlanReference;
    const planId = planReference ? planReference.planId : `plan_${Date.now()}`;

    // Append structured plan data message for serverless handoff (tool result format)
    await this.appendToolResultMessage(state, 'plan_creation', {
      toolName: 'plan_creation',
      success: true,
      result: {
        planId,
        goal: planData.restated_goal,
        steps: planData.plan_steps,
        complexity: planData.complexity_score,
        complexityReasoning: planData.complexity_reasoning,
        skillFocused: planData.skill_focused,
        estimatedDuration: planData.estimated_duration,
        timestamp: Date.now(),
        handoffType: 'serverless_redis_message'
      },
      toolCallId: 'planner_handoff'
    });

    console.log('[PlannerNode] Plan stored in Redis-backed messages for serverless handoff');
    console.log('[PlannerNode] Plan accessible to next serverless instance via message history');
  }

  /**
   * Log completion summary for diagnostics
   */
  private logPlannerCompletion(planData: PlannerResponse): void {
    console.log(`
[PlannerNode] Planning completed successfully:
- Goal: ${planData.restated_goal}
- Steps: ${planData.plan_steps.length}
- Complexity: ${planData.complexity_score}/10
- Skill-focused: ${planData.skill_focused}
- Duration: ${planData.estimated_duration}
    `.trim());
  }

  /**
   * Execute full plan takeover (Strike 3) - INHERIT AND RE-PLAN
   */
  private async executePlanTakeover(state: BaseThreadState, stalePlan: any, userGoal: string, skillTitle: string): Promise<PlannerResponse> {
    const activePlanManager = ActivePlanManager.getInstance();
    const threadId = (state.metadata as any).threadId;
    
    try {
      // Execute takeover
      const takeover = await activePlanManager.attemptPlanTakeover(threadId, stalePlan.planId);
      
      if (!takeover.success) {
        // Fallback to monitoring if takeover fails
        return this.createMonitoringPlanResponse(stalePlan, skillTitle);
      }

      // Create inherited state
      const inheritedState = this.extractInheritedState(stalePlan);
      
      // Generate takeover plan
      const timeSinceStart = Date.now() - stalePlan.startedAt;
      const minutesStalled = Math.floor(timeSinceStart / (1000 * 60));
      
      return {
        restated_goal: `Takeover: ${userGoal}`,
        plan_steps: [
          `🔄 PLAN TAKEOVER INITIATED`,
          `💀 Previous executor ${takeover.previousExecutor} displaced`,
          `🆕 New executor: ${takeover.newExecutorPID}`,
          `📋 Inherited goal: ${stalePlan.goal}`,
          `⏱️ Plan was stalled for ${minutesStalled} minutes`,
          `🔍 Reviewing inherited state and progress`,
          `✅ Verifying completed steps from previous executor`,
          `🚀 Resuming execution with fresh process`,
          `🎯 Completing objective: ${userGoal}`
        ],
        complexity_score: stalePlan.complexity_score ? stalePlan.complexity_score + 1 : 4,
        complexity_reasoning: 'Increased complexity due to plan takeover and state recovery',
        skill_focused: true,
        estimated_duration: '2-4 minutes',
        inheritedState,
        takeoverMetadata: {
          originalExecutor: takeover.previousExecutor ?? 'unknown',
          takeoverTimestamp: Date.now(),
          takeoverReason: 'stalled_plan_recovery',
          originalPlanId: stalePlan.planId,
          stallDuration: timeSinceStart
        }
      };
      
    } catch (error) {
      console.error('[PlannerNode] Plan takeover failed:', error);
      return this.createMonitoringPlanResponse(stalePlan, skillTitle);
    }
  }

  /**
   * Extract inherited state from stale plan
   */
  private extractInheritedState(stalePlan: any): any {
    return {
      originalPlanId: stalePlan.planId,
      originalGoal: stalePlan.goal,
      originalExecutor: stalePlan.executorPID,
      timeElapsed: Date.now() - stalePlan.startedAt,
      lastKnownStatus: stalePlan.status,
      heartbeatHistory: {
        lastHeartbeat: stalePlan.lastHeartbeat,
        heartbeatCount: stalePlan.heartbeatCount,
        expectedInterval: stalePlan.currentHeartbeatInterval
      },
      recoveryNeeded: true,
      skillContext: {
        slug: stalePlan.skillSlug,
        title: stalePlan.skillTitle
      }
    };
  }

  /**
   * Create monitoring response (fallback)
   */
  private createMonitoringPlanResponse(plan: any, skillTitle: string): PlannerResponse {
    const timeSinceHeartbeat = Date.now() - plan.lastHeartbeat;
    const heartbeatMinutes = Math.floor(timeSinceHeartbeat / (1000 * 60));
    const heartbeatSeconds = Math.floor((timeSinceHeartbeat % (1000 * 60)) / 1000);

    return {
      restated_goal: `Monitor ${skillTitle} plan status`,
      plan_steps: [
        `📊 Monitoring existing plan: ${plan.goal}`,
        `🆔 Plan ID: ${plan.planId}`,
        `📈 Status: ${plan.status.toUpperCase()}`,
        `👤 Executor: ${plan.executorPID}`,
        `💓 Last heartbeat: ${heartbeatMinutes}m ${heartbeatSeconds}s ago`,
        `⏰ Started: ${new Date(plan.startedAt).toLocaleTimeString()}`,
        `🔍 Assessing plan health and progress`
      ],
      complexity_score: 2,
      complexity_reasoning: 'Plan monitoring and status assessment',
      skill_focused: true,
      estimated_duration: '1-2 minutes'
    };
  }
}
