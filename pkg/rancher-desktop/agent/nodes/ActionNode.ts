import { BaseNode } from './BaseNode';
import type { BaseThreadState, NodeResult } from './Graph';
import { ActivePlanManager } from './ActivePlanManager';

// Types for evidence collection
interface ActionEvidence {
  evidence_type: 'file_created' | 'file_modified' | 'api_response_data' | 'data_generated' | 'tool_output' | 'installation_confirmed';
  description: string;
  evidence_pointer: string; // Exact reference (file path, API endpoint, data location, etc.)
  evidence_content: any; // Actual evidence content or summary
  verification_method: string; // How this evidence can be verified
  timestamp: number;
}

// Types for action results
interface ActionResult {
  action_type: string;
  tool_name?: string;
  parameters_used: Record<string, any>;
  result: any;
  success: boolean;
  error_message?: string;
  execution_time_ms: number;
  skill_step_completed?: string | null;
  evidence_collected: ActionEvidence[]; // NEW: Specific evidence for task completion
  completion_justification: string; // NEW: Exact reason why task is considered complete
  timestamp: number;
}

/**
 * Action Node - ReAct Loop Component
 * 
 * Purpose:
 *   - Executes actions decided by ReasoningNode
 *   - Calls tools, APIs, or performs data operations
 *   - Records results for next reasoning cycle
 * 
 * Design:
 *   - Takes reasoning decision from metadata
 *   - Executes the specified action/tool call
 *   - Stores results back to metadata
 *   - Returns to ReasoningNode for next cycle
 */
export class ActionNode extends BaseNode {
  constructor() {
    super('action', 'Action');
  }

  async execute(state: BaseThreadState): Promise<NodeResult<BaseThreadState>> {
    const startTime = Date.now();
    
    // Initialize diagnostics metadata
    const diagnostics: Record<string, any> = {
      reasoningDecisionFound: false,
      skillContextExtracted: false,
      actionExecuted: false,
      toolCalled: false,
      resultStored: false,
      planProgressUpdated: false,
      skillProgressUpdated: false,
      executionTimeMs: 0
    };

    // ----------------------------------------------------------------
    // 1. GET REASONING DECISION AND SKILL CONTEXT
    // ----------------------------------------------------------------
    const reasoningDecision = this.getReasoningDecision(state);
    const actionContext = this.extractActionContext(state);
    diagnostics.reasoningDecisionFound = !!reasoningDecision;
    diagnostics.skillContextExtracted = !!actionContext.skillData;
    
    if (!reasoningDecision) {
      console.warn('[ActionNode] No reasoning decision found - cannot execute action');
      return { state, decision: { type: 'next' } };
    }

    // ----------------------------------------------------------------
    // 2. EXECUTE ACTION WITH SKILL CONTEXT
    // ----------------------------------------------------------------
    const actionResult = await this.executeAction(reasoningDecision, actionContext);
    diagnostics.actionExecuted = true;
    diagnostics.toolCalled = !!reasoningDecision.tool_name;
    diagnostics.executionTimeMs = Date.now() - startTime;

    // ----------------------------------------------------------------
    // 3. STORE ACTION RESULT
    // ----------------------------------------------------------------
    this.storeActionResult(state, actionResult);
    diagnostics.resultStored = true;

    // ----------------------------------------------------------------
    // 3.5. UPDATE PLAN PROGRESS
    // ----------------------------------------------------------------
    await this.updatePlanProgress(state, actionResult);
    diagnostics.planProgressUpdated = true;

    // ----------------------------------------------------------------
    // 4. LOG ACTION COMPLETION
    // ----------------------------------------------------------------
    this.logActionCompletion(actionResult);

    // Persist diagnostics to state metadata
    (state.metadata as any).action = {
      ...((state.metadata as any).action || {}),
      diagnostics
    };

    // Return to ReasoningNode for next cycle
    return { 
      state, 
      decision: { type: 'next' } 
    };
  }

  // ======================================================================
  // REASONING DECISION EXTRACTION
  // ======================================================================

  private getReasoningDecision(state: BaseThreadState): any {
    const reasoningData = (state.metadata as any).reasoning;
    const decision = reasoningData?.currentDecision;
    
    if (!decision) {
      console.warn('[ActionNode] No current decision found in reasoning metadata');
      return null;
    }

    console.log(`[ActionNode] Found reasoning decision: ${decision.action_type} - ${decision.next_action}`);
    return decision;
  }

  private extractActionContext(state: BaseThreadState): any {
    const plannerData = (state.metadata as any).planner || {};
    const planRetrievalData = (state.metadata as any).planRetrieval || {};
    const reasoningData = (state.metadata as any).reasoning || {};
    const actionResults = (state.metadata as any).actions || [];

    const context = {
      goal: plannerData.goal || plannerData.restated_goal || 'Complete the requested task',
      skillData: planRetrievalData.skillData || null,
      isSkillFocused: plannerData.skill_focused || false,
      skillProgress: reasoningData.skillProgress || null,
      completedActions: actionResults,
      currentReasoningDecision: reasoningData.currentDecision
    };

    if (context.skillData) {
      console.log(`[ActionNode] Skill-focused execution - Skill: ${context.skillData.title}`);
      if (context.skillProgress) {
        console.log(`[ActionNode] Current skill progress: ${context.skillProgress.progress_percentage}%`);
      }
    }
    
    return context;
  }


  // ======================================================================
  // ACTION EXECUTION
  // ======================================================================

  private async executeAction(decision: any, context: any): Promise<ActionResult> {
    const startTime = Date.now();
    
    try {
      if (context.isSkillFocused && context.skillData) {
        console.log(`[ActionNode] Executing skill-focused action: ${decision.action_type}`);
        console.log(`[ActionNode] Skill context: ${context.skillData.title}`);
        if (context.skillProgress) {
          console.log(`[ActionNode] Current skill step: ${context.skillProgress.current_step}`);
        }
      } else {
        console.log(`[ActionNode] Executing general action: ${decision.action_type}`);
      }
      
      switch (decision.action_type) {
        case 'tool_call':
          return await this.executeSkillAwareToolCall(decision, context);
        case 'api_request':
          return await this.executeSkillAwareApiRequest(decision, context);
        case 'data_analysis':
          return await this.executeSkillAwareDataAnalysis(decision, context);
        case 'complete':
          return this.createSkillAwareCompletionResult(decision, context);
        default:
          console.warn(`[ActionNode] Unknown action type: ${decision.action_type}`);
          return this.createSkillAwareErrorResult(decision, `Unknown action type: ${decision.action_type}`, context);
      }
      
    } catch (error) {
      console.error('[ActionNode] Action execution failed:', error);
      
      return {
        action_type: decision.action_type,
        tool_name: decision.tool_name,
        parameters_used: decision.tool_parameters || {},
        result: null,
        success: false,
        error_message: error instanceof Error ? error.message : String(error),
        execution_time_ms: Date.now() - startTime,
        skill_step_completed: null,
        evidence_collected: [],
        completion_justification: `Action failed with error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      };
    }
  }

  // ======================================================================
  // SPECIFIC ACTION IMPLEMENTATIONS
  // ======================================================================

  private async executeTool(toolName: string, parameters: Record<string, any>): Promise<any> {
    console.log(`[ActionNode] Executing tool: ${toolName}`);
    
    // Simulate tool execution for now - in production this would call actual tools
    switch (toolName) {
      case 'web_search':
        return this.simulateWebSearch(parameters);
        
      case 'file_read':
        return this.simulateFileRead(parameters);
        
      case 'file_write':
        return this.simulateFileWrite(parameters);
        
      case 'api_call':
        return this.simulateAPICall(parameters);
        
      case 'code_execution':
        return this.simulateCodeExecution(parameters);
        
      default:
        return { error: `Tool '${toolName}' not implemented` };
    }
  }

  private async executeAPIRequest(parameters: Record<string, any>): Promise<any> {
    console.log('[ActionNode] Executing API request');
    
    // Simulate API call
    return {
      status: 'success',
      data: `API response for ${parameters.endpoint || 'unknown endpoint'}`,
      response_time_ms: Math.floor(Math.random() * 500) + 100
    };
  }

  private async executeDataAnalysis(parameters: Record<string, any>): Promise<any> {
    console.log('[ActionNode] Executing data analysis');
    
    return {
      analysis_type: parameters.type || 'general',
      findings: ['Sample finding 1', 'Sample finding 2'],
      confidence: 0.85,
      data_points_analyzed: 100
    };
  }

  // ======================================================================
  // SIMULATED TOOL IMPLEMENTATIONS (for testing)
  // ======================================================================

  private async simulateWebSearch(parameters: Record<string, any>): Promise<any> {
    const query = parameters.query || 'default search';
    
    await new Promise(resolve => setTimeout(resolve, 200)); // Simulate delay
    
    return {
      query: query,
      results: [
        { title: `Result 1 for ${query}`, url: 'https://example.com/1', snippet: 'Sample snippet 1' },
        { title: `Result 2 for ${query}`, url: 'https://example.com/2', snippet: 'Sample snippet 2' }
      ],
      total_results: 2
    };
  }

  private async simulateFileRead(parameters: Record<string, any>): Promise<any> {
    const filename = parameters.filename || 'unknown.txt';
    
    return {
      filename: filename,
      content: `Simulated content of ${filename}`,
      size_bytes: 1024,
      last_modified: new Date().toISOString()
    };
  }

  private async simulateFileWrite(parameters: Record<string, any>): Promise<any> {
    const filename = parameters.filename || 'output.txt';
    const content = parameters.content || 'default content';
    
    return {
      filename: filename,
      bytes_written: content.length,
      success: true
    };
  }

  private async simulateAPICall(parameters: Record<string, any>): Promise<any> {
    const endpoint = parameters.endpoint || '/api/default';
    
    await new Promise(resolve => setTimeout(resolve, 150)); // Simulate delay
    
    return {
      endpoint: endpoint,
      method: parameters.method || 'GET',
      status_code: 200,
      response: { message: `API call to ${endpoint} successful` }
    };
  }

  private async simulateCodeExecution(parameters: Record<string, any>): Promise<any> {
    const code = parameters.code || 'console.log("Hello World");';
    
    return {
      code_executed: code,
      output: 'Hello World',
      execution_time_ms: 50,
      exit_code: 0
    };
  }

  // ======================================================================
  // RESULT STORAGE
  // ======================================================================

  private storeActionResult(state: BaseThreadState, result: ActionResult): void {
    // Initialize actions array if it doesn't exist
    if (!(state.metadata as any).actions) {
      (state.metadata as any).actions = [];
    }
    
    // Add this action result to the history
    (state.metadata as any).actions.push(result);
    
    // Also store as the latest action for easy access
    (state.metadata as any).latestAction = result;
    
    console.log(`[ActionNode] Action result stored: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  }

  // ======================================================================
  // SKILL-AWARE ACTION IMPLEMENTATIONS
  // ======================================================================

  private async executeSkillAwareToolCall(decision: any, context: any): Promise<ActionResult> {
    const toolName = decision.tool_name || 'web_search';
    const parameters = decision.tool_parameters || {};
    
    // Add skill context to tool parameters if available
    if (context.isSkillFocused && context.skillData) {
      parameters.skill_context = {
        skill_title: context.skillData.title,
        current_step: context.skillProgress?.current_step,
        goal: context.goal
      };
    }
    
    console.log(`[ActionNode] ${context.isSkillFocused ? 'Skill-focused' : 'General'} tool call: ${toolName}`);
    
    const result = await this.executeTool(toolName, parameters);
    const evidence = this.collectToolCallEvidence(toolName, parameters, result, context);
    const justification = this.generateCompletionJustification('tool_call', evidence, context);
    
    return {
      action_type: 'tool_call',
      tool_name: toolName,
      parameters_used: parameters,
      result,
      success: !!result,
      execution_time_ms: 250,
      skill_step_completed: context.skillProgress?.current_step || null,
      evidence_collected: evidence,
      completion_justification: justification,
      timestamp: Date.now()
    };
  }

  private async executeSkillAwareApiRequest(decision: any, context: any): Promise<ActionResult> {
    const parameters = decision.tool_parameters || {};
    
    // Include skill context in API request
    if (context.isSkillFocused && context.skillData) {
      parameters.skill_context = context.skillData.title;
    }
    
    console.log(`[ActionNode] ${context.isSkillFocused ? 'Skill-focused' : 'General'} API request`);
    
    const result = await this.executeAPIRequest(parameters);
    const evidence = this.collectApiResponseEvidence(parameters, result, context);
    const justification = this.generateCompletionJustification('api_request', evidence, context);
    
    return {
      action_type: 'api_request',
      parameters_used: parameters,
      result,
      success: !!result,
      execution_time_ms: 180,
      skill_step_completed: context.skillProgress?.current_step || null,
      evidence_collected: evidence,
      completion_justification: justification,
      timestamp: Date.now()
    };
  }

  private async executeSkillAwareDataAnalysis(decision: any, context: any): Promise<ActionResult> {
    const parameters = decision.tool_parameters || {};
    
    console.log(`[ActionNode] ${context.isSkillFocused ? 'Skill-focused' : 'General'} data analysis`);
    
    const result = await this.executeDataAnalysis(parameters);
    const evidence = this.collectDataAnalysisEvidence(parameters, result, context);
    const justification = this.generateCompletionJustification('data_analysis', evidence, context);
    
    return {
      action_type: 'data_analysis',
      parameters_used: parameters,
      result,
      success: true,
      execution_time_ms: 120,
      skill_step_completed: context.skillProgress?.current_step || null,
      evidence_collected: evidence,
      completion_justification: justification,
      timestamp: Date.now()
    };
  }

  private createSkillAwareCompletionResult(decision: any, context: any): ActionResult {
    const completionMessage = context.isSkillFocused && context.skillData
      ? `Skill '${context.skillData.title}' completed successfully`
      : 'Task completed successfully';
    
    console.log(`[ActionNode] ${completionMessage}`);
    
    const evidence = this.collectCompletionEvidence(context);
    const justification = this.generateCompletionJustification('complete', evidence, context);
    
    return {
      action_type: 'complete',
      parameters_used: {},
      result: { message: completionMessage },
      success: true,
      execution_time_ms: 10,
      skill_step_completed: context.skillProgress?.current_step || null,
      evidence_collected: evidence,
      completion_justification: justification,
      timestamp: Date.now()
    };
  }

  private createSkillAwareErrorResult(decision: any, errorMessage: string, context: any): ActionResult {
    const contextualError = context.isSkillFocused && context.skillData
      ? `Error in skill '${context.skillData.title}': ${errorMessage}`
      : errorMessage;
    
    console.error(`[ActionNode] ${contextualError}`);
    
    return {
      action_type: decision.action_type,
      tool_name: decision.tool_name,
      parameters_used: decision.tool_parameters || {},
      result: null,
      success: false,
      error_message: contextualError,
      execution_time_ms: 5,
      skill_step_completed: null,
      evidence_collected: [],
      completion_justification: `Task failed: ${contextualError}`,
      timestamp: Date.now()
    };
  }

  // ======================================================================
  // EVIDENCE COLLECTION METHODS
  // ======================================================================

  private collectToolCallEvidence(toolName: string, parameters: any, result: any, context: any): ActionEvidence[] {
    const evidence: ActionEvidence[] = [];
    const timestamp = Date.now();
    
    if (result && typeof result === 'object') {
      // File evidence
      if (result.files_created || result.file_content || result.files_modified) {
        evidence.push({
          evidence_type: 'file_created',
          description: `Tool ${toolName} created/modified files`,
          evidence_pointer: result.file_path || result.output_file || 'Generated file content',
          evidence_content: result.file_content || result.files_created || result.files_modified,
          verification_method: 'Check file system for file existence and content',
          timestamp
        });
      }
      
      // Tool output evidence
      if (result.search_results || result.data || result.findings || result.output) {
        evidence.push({
          evidence_type: 'tool_output',
          description: `Tool ${toolName} produced substantive output`,
          evidence_pointer: `${toolName} execution result`,
          evidence_content: result.search_results || result.data || result.findings || result.output,
          verification_method: 'Review tool output for expected content and format',
          timestamp
        });
      }
      
      // Installation evidence
      if (result.installation_success || result.version_info || result.setup_complete) {
        evidence.push({
          evidence_type: 'installation_confirmed',
          description: `Tool ${toolName} confirmed installation/setup`,
          evidence_pointer: 'System installation status',
          evidence_content: result.version_info || result.installation_success || result.setup_complete,
          verification_method: 'Check system for installed software and version info',
          timestamp
        });
      }
    }
    
    console.log(`[ActionNode] Collected ${evidence.length} pieces of evidence for tool call ${toolName}`);
    return evidence;
  }

  private collectApiResponseEvidence(parameters: any, result: any, context: any): ActionEvidence[] {
    const evidence: ActionEvidence[] = [];
    const timestamp = Date.now();
    
    if (result && typeof result === 'object') {
      if (result.data || result.response || result.payload || result.results) {
        evidence.push({
          evidence_type: 'api_response_data',
          description: 'API returned substantive response data',
          evidence_pointer: parameters.endpoint || parameters.url || 'API endpoint',
          evidence_content: result.data || result.response || result.payload || result.results,
          verification_method: 'Verify API response contains expected data structure and content',
          timestamp
        });
      }
      
      if (result.status_code === 200 || result.success) {
        evidence.push({
          evidence_type: 'api_response_data',
          description: 'API call completed successfully',
          evidence_pointer: 'HTTP status code and response headers',
          evidence_content: { status: result.status_code || 'success', headers: result.headers },
          verification_method: 'Check HTTP status code and response metadata',
          timestamp
        });
      }
    }
    
    console.log(`[ActionNode] Collected ${evidence.length} pieces of evidence for API request`);
    return evidence;
  }

  private collectDataAnalysisEvidence(parameters: any, result: any, context: any): ActionEvidence[] {
    const evidence: ActionEvidence[] = [];
    const timestamp = Date.now();
    
    if (result && typeof result === 'object') {
      if (result.analysis || result.insights || result.summary || result.metrics || result.findings) {
        evidence.push({
          evidence_type: 'data_generated',
          description: 'Data analysis produced substantive results',
          evidence_pointer: 'Analysis output and metrics',
          evidence_content: result.analysis || result.insights || result.summary || result.metrics || result.findings,
          verification_method: 'Review analysis results for completeness and accuracy',
          timestamp
        });
      }
      
      if (result.charts || result.visualizations || result.reports) {
        evidence.push({
          evidence_type: 'file_created',
          description: 'Data analysis generated visual outputs',
          evidence_pointer: 'Generated charts, reports, or visualizations',
          evidence_content: result.charts || result.visualizations || result.reports,
          verification_method: 'Verify generated visual outputs exist and display correctly',
          timestamp
        });
      }
    }
    
    console.log(`[ActionNode] Collected ${evidence.length} pieces of evidence for data analysis`);
    return evidence;
  }

  private collectCompletionEvidence(context: any): ActionEvidence[] {
    const evidence: ActionEvidence[] = [];
    const timestamp = Date.now();
    
    // Collect evidence from completed actions in context
    if (context.completedActions && context.completedActions.length > 0) {
      const completedActions = context.completedActions;
      const successfulActions = completedActions.filter((action: any) => action.success);
      
      evidence.push({
        evidence_type: 'tool_output',
        description: `Completed ${successfulActions.length} successful actions out of ${completedActions.length} total`,
        evidence_pointer: 'Action execution history',
        evidence_content: {
          total_actions: completedActions.length,
          successful_actions: successfulActions.length,
          success_rate: Math.round((successfulActions.length / completedActions.length) * 100)
        },
        verification_method: 'Review action execution history for completion status',
        timestamp
      });
    }
    
    // Skill completion evidence
    if (context.isSkillFocused && context.skillProgress) {
      evidence.push({
        evidence_type: 'tool_output',
        description: `Skill progress: ${context.skillProgress.progress_percentage}%`,
        evidence_pointer: 'Skill template progress tracking',
        evidence_content: {
          skill_title: context.skillProgress.skill_title,
          completed_steps: context.skillProgress.completed_steps,
          progress_percentage: context.skillProgress.progress_percentage
        },
        verification_method: 'Verify skill steps completion against skill template',
        timestamp
      });
    }
    
    console.log(`[ActionNode] Collected ${evidence.length} pieces of evidence for completion`);
    return evidence;
  }

  private generateCompletionJustification(actionType: string, evidence: ActionEvidence[], context: any): string {
    if (evidence.length === 0) {
      return `${actionType} completed but no evidence collected - verification required`;
    }
    
    const evidenceDescriptions = evidence.map(e => `${e.evidence_type}: ${e.description}`);
    const skillContext = context.isSkillFocused && context.skillData 
      ? ` for skill "${context.skillData.title}"` 
      : '';
    
    const justification = `Task completion${skillContext} verified by ${evidence.length} evidence points: ${evidenceDescriptions.join('; ')}. Evidence can be verified through: ${evidence.map(e => e.verification_method).join('; ')}.`;
    
    console.log(`[ActionNode] Generated completion justification: ${justification.substring(0, 100)}...`);
    return justification;
  }

  // ======================================================================
  // ACTIVE PLAN MANAGEMENT
  // ======================================================================

  private async updatePlanProgress(state: BaseThreadState, actionResult: ActionResult): Promise<void> {
    try {
      const reasoningData = (state.metadata as any).reasoning;
      const activePlanId = reasoningData?.activePlanId;
      
      if (activePlanId) {
        const threadId = state.metadata.threadId;
        const activePlanManager = ActivePlanManager.getInstance();
        const executorPID = process.pid.toString();
        
        // Send heartbeat to indicate we're still working
        const heartbeatResult = await activePlanManager.sendHeartbeat(threadId, activePlanId, executorPID);
        
        console.log(`[ActionNode] Plan progress updated for: ${activePlanId}`);
        console.log(`[ActionNode] Action: ${actionResult.action_type}, Success: ${actionResult.success}`);
        
        if (!heartbeatResult.success) {
          console.warn(`[ActionNode] Plan heartbeat failed - may have been taken over`);
        }
      } else {
        console.log('[ActionNode] No active plan ID found - skipping progress update');
      }
    } catch (error) {
      console.warn('[ActionNode] Error updating plan progress:', error);
    }
  }

  private logActionCompletion(result: ActionResult): void {
    console.log(`[ActionNode] Action completed:
- Type: ${result.action_type}
- Tool: ${result.tool_name || 'None'}
- Success: ${result.success}
- Duration: ${result.execution_time_ms}ms
- Result: ${JSON.stringify(result.result).substring(0, 100)}...`);
  }
}
