import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import type { BaseThreadState, NodeResult } from './Graph';
import { toolRegistry } from '../tools';
import { ActivePlanManager } from './ActivePlanManager';

// Types for evidence-based verification
interface VerificationEvidence {
  evidence_type: 'file_exists' | 'api_response' | 'data_output' | 'tool_result' | 'user_confirmation';
  description: string;
  verification_method: string;
  expected_outcome: string;
  actual_evidence: string | null;
  verified: boolean;
}

interface TaskVerification {
  task_description: string;
  verification_required: boolean;
  evidence_needed: VerificationEvidence[];
  verification_status: 'pending' | 'verified' | 'failed' | 'not_required';
  verification_notes: string;
}

// Types for reasoning responses
interface ReasoningResponse {
  current_situation: string;
  goal_progress: string;
  next_action: string;
  action_type: 'continue' | 'complete' | 'verify_evidence';
  reasoning: string;
  confidence: number;
  stop_condition_met: boolean;
  task_verification?: TaskVerification;
  skill_progress?: {
    skill_title: string;
    completed_steps: string[];
    current_step: string;
    remaining_steps: string[];
    progress_percentage: number;
    pending_verification: string[];  // Steps awaiting evidence verification
  };
}

// Reasoning prompt template
const REASONING_PROMPT = `You are a ReAct reasoning agent that analyzes the current situation and decides the next action to take.

## Current Context
Goal: {{goal}}
Plan Steps: {{plan_steps}}
Completed Actions: {{completed_actions}}
Current Step: {{current_step}}
Previous Action Result: {{previous_action_result}}

{{skill_context}}

## Your Task
1. **Analyze Current Situation**: Review what has been accomplished and what remains
2. **Assess Goal Progress**: Determine how close we are to completion
{{skill_analysis_task}}
3. **Plan Next Action**: Choose the most logical next step
4. **Specify Action Details**: Provide tool name and parameters if needed

## Decision Framework
- If goal is achieved: set stop_condition_met = true
- If more work needed: specify next action with tool details
- Always provide reasoning for your decision
- Be specific about tool parameters
{{skill_decision_framework}}

## Evidence-Based Verification
**CRITICAL**: You are a quality inspector. DO NOT mark tasks as complete based solely on action results.
You MUST require factual evidence to verify work completion:

- **File Creation**: Verify files actually exist and contain expected content
- **API Responses**: Check actual API response data, not just "success" messages  
- **Data Output**: Examine actual data produced, not just execution reports
- **Tool Results**: Verify tool actually produced expected outcomes
- **User Confirmation**: Get explicit confirmation for subjective tasks

**Verification Process**:
1. **Analyze Action Results**: What was claimed to be done?
2. **Identify Required Evidence**: What proof is needed to confirm completion?
3. **Check Available Evidence**: What factual evidence do we have?
4. **Verification Decision**: Mark complete only with sufficient proof
5. **Request Additional Evidence**: If proof is insufficient, request verification actions

**DO NOT** mark skill steps complete without verifiable evidence!

${JSON_ONLY_RESPONSE_INSTRUCTIONS}

{
  "current_situation": "Brief assessment of current state",
  "goal_progress": "How close are we to completion (percentage or milestone)",
  "next_action": "Specific action to take next (BaseNode will handle any tool calls automatically)",
  "action_type": "continue|complete|verify_evidence",
  "reasoning": "Detailed explanation of decision including verification analysis",
  "confidence": 0.85,
  "stop_condition_met": false,
  "task_verification": {
    "task_description": "Description of task being verified",
    "verification_required": true,
    "evidence_needed": [
      {
        "evidence_type": "file_exists|api_response|data_output|tool_result|user_confirmation",
        "description": "What evidence is needed",
        "verification_method": "How to verify this evidence",
        "expected_outcome": "What should be found",
        "actual_evidence": null,
        "verified": false
      }
    ],
    "verification_status": "pending",
    "verification_notes": "Additional notes about verification requirements"
  }{{skill_progress_field}}
}`;

/**
 * Reasoning Node - ReAct Loop Component
 * 
 * Purpose:
 *   - Analyzes current state and progress toward goal
 *   - Decides what action should be taken next
 *   - Determines if goal has been achieved (stop condition)
 * 
 * Design:
 *   - Takes plan and previous action results as input
 *   - Uses LLM to reason about next steps
 *   - Returns structured decision for ActionNode
 *   - Tracks progress and completion status
 */
export class ReasoningNode extends BaseNode {
  constructor() {
    super('reasoning', 'Reasoning');
  }

  async execute(state: BaseThreadState): Promise<NodeResult<BaseThreadState>> {
    // Initialize diagnostics metadata
    const diagnostics: Record<string, any> = {
      contextExtracted: false,
      reasoningCompleted: false,
      decisionMade: false,
      activePlanChecked: false,
      heartbeatSent: false
    };

    // ----------------------------------------------------------------
    // 0. CHECK ACTIVE PLAN AND SEND HEARTBEAT
    // ----------------------------------------------------------------
    await this.checkActivePlanAndSendHeartbeat(state);
    diagnostics.activePlanChecked = true;
    diagnostics.heartbeatSent = true;

    // ----------------------------------------------------------------
    // 1. EXTRACT CURRENT CONTEXT
    // ----------------------------------------------------------------
    const context = this.extractReasoningContext(state);
    diagnostics.goalExtracted = !!context.goal;
    diagnostics.planAnalyzed = !!context.planSteps;

    // ----------------------------------------------------------------
    // 2. ANALYZE SITUATION AND DECIDE NEXT ACTION
    // ----------------------------------------------------------------
    const reasoningDecision = await this.analyzeAndDecide(state, context);
    
    if (!reasoningDecision) {
      // Fallback reasoning when LLM fails
      const fallbackDecision = this.createFallbackReasoning(context);
      this.storeReasoningDecision(state, fallbackDecision);
      diagnostics.actionDecided = true;
      diagnostics.reasoningConfidence = fallbackDecision.confidence;
    } else {
      this.storeReasoningDecision(state, reasoningDecision);
      diagnostics.actionDecided = true;
      diagnostics.stopConditionChecked = true;
      diagnostics.reasoningConfidence = reasoningDecision.confidence;
    }

    // ----------------------------------------------------------------
    // 3. DETERMINE NEXT NODE
    // ----------------------------------------------------------------
    const decision = await this.determineNextNode(state);
    
    // ----------------------------------------------------------------
    // 4. LOG REASONING COMPLETION
    // ----------------------------------------------------------------
    this.logReasoningCompletion(reasoningDecision || this.createFallbackReasoning(context));

    // Persist diagnostics to state metadata
    (state.metadata as any).reasoning = {
      ...((state.metadata as any).reasoning || {}),
      diagnostics
    };

    return { 
      state, 
      decision 
    };
  }

  // ======================================================================
  // CONTEXT EXTRACTION
  // ======================================================================

  private extractReasoningContext(state: BaseThreadState): any {
    // LangGraph provides per-run state isolation - no need for execution namespacing
    const plannerData = (state.metadata as any).planner || {};
    const planRetrievalData = (state.metadata as any).planRetrieval || {};
    const reasoningData = (state.metadata as any).reasoning || {};
    const actionResults = (state.metadata as any).actions || [];

    const context = {
      goal: plannerData.goal || plannerData.restated_goal || 'Complete the requested task',
      planSteps: plannerData.plan_steps || [],
      completedActions: actionResults,
      currentStep: reasoningData.currentStep || 0,
      previousActionResult: this.getPreviousActionResult(state),
      skillData: planRetrievalData.skillData || null,
      isSkillFocused: plannerData.skill_focused || false
    };

    console.log(`[ReasoningNode] Context extracted - Goal: "${context.goal}", Plan steps: ${context.planSteps.length}, Completed actions: ${context.completedActions.length}`);
    
    if (context.skillData) {
      console.log(`[ReasoningNode] Skill-focused reasoning - Skill: ${context.skillData.title}`);
    }
    
    return context;
  }

  // ======================================================================
  // SKILL-AWARE REASONING
  // ======================================================================

  private buildReasoningPrompt(context: any): string {
    let prompt = REASONING_PROMPT
      .replace('{{goal}}', context.goal)
      .replace('{{plan_steps}}', JSON.stringify(context.planSteps, null, 2))
      .replace('{{completed_actions}}', JSON.stringify(context.completedActions, null, 2))
      .replace('{{current_step}}', context.currentStep.toString())
      .replace('{{previous_action_result}}', context.previousActionResult);

    if (context.skillData && context.isSkillFocused) {
      // Build skill-specific context
      const skillContext = this.buildSkillContext(context.skillData);
      const skillAnalysisTask = '2.5. **Verify Skill Progress**: Compare completed actions against skill template and update progress';
      const skillDecisionFramework = `- **SKILL COMPLIANCE**: Follow the skill template steps exactly unless user explicitly overrides\n- **PROGRESS TRACKING**: Mark off completed skill steps and identify next required step\n- **STEP VERIFICATION**: Ensure each action aligns with the skill methodology`;
      const skillProgressField = `,\n  "skill_progress": {\n    "skill_title": "${context.skillData.title}",\n    "completed_steps": ["Step 1: Description"],\n    "current_step": "Step 2: Current step description",\n    "remaining_steps": ["Step 3: Next step"],\n    "progress_percentage": 40\n  }`;

      prompt = prompt
        .replace('{{skill_context}}', skillContext)
        .replace('{{skill_analysis_task}}', skillAnalysisTask)
        .replace('{{skill_decision_framework}}', skillDecisionFramework)
        .replace('{{skill_progress_field}}', skillProgressField);
    } else {
      // Remove skill placeholders for general reasoning
      prompt = prompt
        .replace('{{skill_context}}', '')
        .replace('{{skill_analysis_task}}', '')
        .replace('{{skill_decision_framework}}', '')
        .replace('{{skill_progress_field}}', '');
    }

    return prompt;
  }

  private buildSkillContext(skillData: any): string {
    return `## Selected Skill: ${skillData.title}

**Skill Description**: ${skillData.excerpt || 'No description available'}

**Skill Template**:
${skillData.document || 'No template available'}

**IMPORTANT**: This is a Standard Operating Procedure (SOP). Follow these exact steps unless explicitly overridden by the user. Verify each step completion and track progress against this template.`;
  }

  private updateSkillProgress(state: BaseThreadState, skillProgress: any): void {
    // Only update progress after evidence verification
    const verifiedProgress = this.verifySkillProgressEvidence(state, skillProgress);
    
    // Store verified skill progress in reasoning metadata
    (state.metadata as any).reasoning = {
      ...((state.metadata as any).reasoning || {}),
      skillProgress: verifiedProgress,
      lastProgressUpdate: Date.now()
    };
    
    console.log(`[ReasoningNode] Verified skill progress updated:`);
    console.log(`  - Skill: ${verifiedProgress.skill_title}`);
    console.log(`  - Progress: ${verifiedProgress.progress_percentage}%`);
    console.log(`  - Verified Completed: ${verifiedProgress.completed_steps.length} steps`);
    console.log(`  - Pending Verification: ${verifiedProgress.pending_verification?.length || 0} steps`);
    console.log(`  - Remaining: ${verifiedProgress.remaining_steps.length} steps`);
  }

  // ======================================================================
  // EVIDENCE-BASED VERIFICATION
  // ======================================================================

  private verifySkillProgressEvidence(state: BaseThreadState, skillProgress: any): any {
    const actionResults = (state.metadata as any).actions || [];
    const verifiedCompletedSteps: string[] = [];
    const pendingVerification: string[] = [];
    
    // Analyze each claimed completed step
    for (const step of skillProgress.completed_steps || []) {
      if (this.hasFactualEvidence(step, actionResults)) {
        verifiedCompletedSteps.push(step);
        console.log(`[ReasoningNode] ✅ Step verified with evidence: ${step}`);
      } else {
        pendingVerification.push(step);
        console.log(`[ReasoningNode] ⏳ Step needs verification: ${step}`);
      }
    }
    
    return {
      ...skillProgress,
      completed_steps: verifiedCompletedSteps,
      pending_verification: pendingVerification,
      progress_percentage: Math.round((verifiedCompletedSteps.length / 
        (skillProgress.completed_steps?.length + skillProgress.remaining_steps?.length || 1)) * 100)
    };
  }

  private hasFactualEvidence(stepDescription: string, actionResults: any[]): boolean {
    // Check recent action results for factual evidence
    const recentActions = actionResults.slice(-5); // Check last 5 actions
    
    for (const action of recentActions) {
      if (this.actionProvidesEvidence(stepDescription, action)) {
        return true;
      }
    }
    
    return false;
  }

  private actionProvidesEvidence(stepDescription: string, action: any): boolean {
    if (!action.success || !action.result) {
      return false;
    }
    
    // Check different types of evidence
    switch (action.action_type) {
      case 'tool_call':
        return this.verifyToolCallEvidence(stepDescription, action);
      case 'api_request':
        return this.verifyApiResponseEvidence(stepDescription, action);
      case 'data_analysis':
        return this.verifyDataOutputEvidence(stepDescription, action);
      default:
        return false;
    }
  }

  private verifyToolCallEvidence(stepDescription: string, action: any): boolean {
    const result = action.result;
    
    // File creation/modification evidence
    if (stepDescription.toLowerCase().includes('file') || stepDescription.toLowerCase().includes('create')) {
      return !!(result.files_created || result.files_modified || result.file_content);
    }
    
    // Search/research evidence
    if (stepDescription.toLowerCase().includes('search') || stepDescription.toLowerCase().includes('research')) {
      return !!(result.search_results || result.data || result.findings);
    }
    
    // Installation/setup evidence
    if (stepDescription.toLowerCase().includes('install') || stepDescription.toLowerCase().includes('setup')) {
      return !!(result.installation_success || result.setup_complete || result.version_info);
    }
    
    // Generic success with substantive result
    return typeof result === 'object' && Object.keys(result).length > 0;
  }

  private verifyApiResponseEvidence(stepDescription: string, action: any): boolean {
    const result = action.result;
    
    // API must return actual data, not just success message
    if (typeof result === 'object' && result !== null) {
      return !!(result.data || result.response || result.payload || result.results);
    }
    
    return false;
  }

  private verifyDataOutputEvidence(stepDescription: string, action: any): boolean {
    const result = action.result;
    
    // Data analysis must produce actual analysis results
    if (typeof result === 'object' && result !== null) {
      return !!(result.analysis || result.insights || result.summary || result.metrics || result.findings);
    }
    
    return false;
  }

  private createVerificationRequest(stepDescription: string, evidenceType: string): TaskVerification {
    return {
      task_description: stepDescription,
      verification_required: true,
      evidence_needed: [{
        evidence_type: evidenceType as any,
        description: `Verify completion of: ${stepDescription}`,
        verification_method: this.getVerificationMethod(evidenceType),
        expected_outcome: this.getExpectedOutcome(stepDescription, evidenceType),
        actual_evidence: null,
        verified: false
      }],
      verification_status: 'pending',
      verification_notes: `Evidence verification required for step: ${stepDescription}`
    };
  }

  private getVerificationMethod(evidenceType: string): string {
    switch (evidenceType) {
      case 'file_exists': return 'Check file system for file existence and content';
      case 'api_response': return 'Examine API response data and status';
      case 'data_output': return 'Review generated data and analysis results';
      case 'tool_result': return 'Verify tool execution output and effects';
      case 'user_confirmation': return 'Request explicit user confirmation';
      default: return 'Manual verification required';
    }
  }

  private getExpectedOutcome(stepDescription: string, evidenceType: string): string {
    if (stepDescription.toLowerCase().includes('file')) {
      return 'File exists with expected content';
    }
    if (stepDescription.toLowerCase().includes('api')) {
      return 'API returns valid response data';
    }
    if (stepDescription.toLowerCase().includes('install')) {
      return 'Software installed and functional';
    }
    return `Evidence that step "${stepDescription}" was completed successfully`;
  }

  // ======================================================================
  // ACTIVE PLAN MANAGEMENT
  // ======================================================================

  private async checkActivePlanAndSendHeartbeat(state: BaseThreadState): Promise<void> {
    try {
      const threadId = state.metadata.threadId;
      const activePlanManager = ActivePlanManager.getInstance();
      
      // Get active plans for this thread
      const activePlans = await activePlanManager.getActivePlans(threadId);
      
      if (activePlans.length > 0) {
        // Send heartbeat for the most recent active plan
        const currentPlan = activePlans[0];
        const executorPID = process.pid.toString();
        await activePlanManager.sendHeartbeat(threadId, currentPlan.planId, executorPID);
        
        console.log(`[ReasoningNode] Heartbeat sent for active plan: ${currentPlan.planId}`);
        console.log(`[ReasoningNode] Plan status: ${currentPlan.status}, Skill: ${currentPlan.skillTitle || 'General'}`);
        
        // Store active plan context in reasoning metadata
        (state.metadata as any).reasoning = {
          ...((state.metadata as any).reasoning || {}),
          activePlanId: currentPlan.planId,
          activePlanStatus: currentPlan.status,
          activePlanSkill: currentPlan.skillSlug
        };
      } else {
        console.log('[ReasoningNode] No active plans found for this thread');
      }
    } catch (error) {
      console.warn('[ReasoningNode] Error checking active plans:', error);
    }
  }


  private getPreviousActionResult(state: BaseThreadState): string {
    const actions = (state.metadata as any).actions || [];
    if (actions.length === 0) return 'No previous actions taken';
    
    const lastAction = actions[actions.length - 1];
    return `Last action: ${lastAction.action_type} - ${lastAction.result || 'No result'}`;
  }


  // ======================================================================
  // REASONING AND DECISION MAKING
  // ======================================================================

  private async analyzeAndDecide(state: BaseThreadState, context: any): Promise<ReasoningResponse | null> {
    try {
      console.log(`[ReasoningNode] Analyzing situation and deciding next action`);
      
      // Build skill-aware prompt if we have skill data
      const prompt = this.buildReasoningPrompt(context);

      // Create temporary state for reasoning
      const tempState = {
        ...state,
        messages: state.messages.concat([{ role: 'user', content: prompt }])
      };
      
      const response = await this.chat(tempState, '', {
        format: 'json' as const
      });

      const reasoningResponse = JSON.parse(response.content) as ReasoningResponse;
      
      // Store skill progress if available
      if (reasoningResponse.skill_progress) {
        this.updateSkillProgress(state, reasoningResponse.skill_progress);
      }
      
      return reasoningResponse;
    } catch (error) {
      console.warn('[ReasoningNode] LLM reasoning failed:', error);
      return null;
    }
  }

  private createFallbackReasoning(context: any): ReasoningResponse {
    // Simple fallback when LLM reasoning fails
    return {
      current_situation: 'Unable to perform detailed analysis, proceeding with basic action',
      goal_progress: 'Progress uncertain, taking next logical step',
      next_action: 'Continue with planned steps - BaseNode will handle any required tool calls',
      action_type: 'continue',
      reasoning: 'Fallback reasoning due to analysis failure - continuing with available information',
      confidence: 0.3,
      stop_condition_met: false
    };
  }

  private storeReasoningDecision(state: BaseThreadState, decision: ReasoningResponse): void {
    (state.metadata as any).reasoning = {
      ...((state.metadata as any).reasoning || {}),
      currentDecision: decision,
      timestamp: Date.now()
    };
    
    console.log(`[ReasoningNode] Decision stored: ${decision.action_type} - ${decision.next_action}`);
  }

  private async determineNextNode(state: BaseThreadState): Promise<{ type: 'next' | 'end' }> {
    const reasoningData = (state.metadata as any).reasoning;
    const decision = reasoningData?.currentDecision;
    
    if (decision?.stop_condition_met || decision?.action_type === 'complete') {
      console.log('[ReasoningNode] Goal achieved - ending ReAct loop');
      await this.handlePlanCompletion(state);
      return { type: 'end' };
    }
    
    console.log('[ReasoningNode] Proceeding to ActionNode');
    return { type: 'next' };
  }

  private async handlePlanCompletion(state: BaseThreadState): Promise<void> {
    try {
      const reasoningData = (state.metadata as any).reasoning;
      const activePlanId = reasoningData?.activePlanId;
      
      if (activePlanId) {
        const activePlanManager = ActivePlanManager.getInstance();
        const threadId = state.metadata.threadId;
        await activePlanManager.removeActivePlan(threadId, activePlanId);
        console.log(`[ReasoningNode] Marked plan ${activePlanId} as completed`);
      }
    } catch (error) {
      console.warn('[ReasoningNode] Error completing plan:', error);
    }
  }

  private logReasoningCompletion(decision: ReasoningResponse): void {
    console.log(`[ReasoningNode] Reasoning completed:
- Situation: ${decision.current_situation}
- Next Action: ${decision.next_action}
- Action Type: ${decision.action_type}
- Confidence: ${Math.round(decision.confidence * 100)}%
- Complete: ${decision.stop_condition_met}`);
  }
}
