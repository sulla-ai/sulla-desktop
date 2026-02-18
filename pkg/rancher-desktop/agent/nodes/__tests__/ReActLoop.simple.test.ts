/**
 * Simple Test for ReAct Loop - ReasoningNode + ActionNode Integration
 * Testing the cycle: Reasoning → Action → Reasoning → Action until goal achieved
 */

import { ReasoningNode } from '../ReasoningNode';
import { ActionNode } from '../ActionNode';
import type { BaseThreadState } from '../Graph';

// Mock BaseNode to provide LLM capabilities for ReasoningNode
jest.mock('../BaseNode', () => ({
  BaseNode: class MockBaseNode {
    constructor(public id: string, public name: string) {}
    
    async chat(messages: any[], model: string, local: boolean) {
      // Mock LLM responses for different reasoning scenarios
      if (messages.some(m => m.content?.includes('web search for React tutorials'))) {
        return {
          content: JSON.stringify({
            current_situation: 'User wants to learn React, need to find educational resources',
            goal_progress: '0% complete - starting research phase',
            next_action: 'Search for React learning materials',
            action_type: 'tool_call',
            tool_name: 'web_search',
            tool_parameters: { query: 'React tutorials for beginners' },
            reasoning: 'Web search is the best first step to gather learning resources',
            confidence: 0.9,
            stop_condition_met: false
          })
        };
      }
      
      if (messages.some(m => m.content?.includes('Web search completed'))) {
        return {
          content: JSON.stringify({
            current_situation: 'Found React tutorials, user can now start learning',
            goal_progress: '100% complete - resources located successfully',
            next_action: 'Goal achieved - user has learning resources',
            action_type: 'complete',
            reasoning: 'Successfully found relevant React tutorials, goal accomplished',
            confidence: 0.95,
            stop_condition_met: true
          })
        };
      }
      
      // Default reasoning response
      return {
        content: JSON.stringify({
          current_situation: 'Analyzing current state',
          goal_progress: '50% complete',
          next_action: 'Continue with planned steps',
          action_type: 'tool_call',
          tool_name: 'web_search',
          tool_parameters: { query: 'general search' },
          reasoning: 'Taking next logical step',
          confidence: 0.7,
          stop_condition_met: false
        })
      };
    }
  },
  JSON_ONLY_RESPONSE_INSTRUCTIONS: 'Mock JSON instructions'
}));

describe('ReAct Loop Simple Test', () => {
  
  test('should complete full ReAct cycle: Reasoning → Action → Reasoning → Stop', async () => {
    const reasoningNode = new ReasoningNode();
    const actionNode = new ActionNode();
    
    // Initial state with a simple goal from PlannerNode
    let state: any = {
      messages: [
        { role: 'user', content: 'I want to learn React development' }
      ],
      metadata: {
        action: 'use_tools',
        threadId: 'react_test_001',
        wsChannel: 'test',
        llmModel: 'claude-3-haiku',
        llmLocal: false,
        cycleComplete: false,
        waitingForUser: false,
        options: {},
        currentNodeId: 'reasoning',
        consecutiveSameNode: 0,
        iterations: 0,
        revisionCount: 0,
        maxIterationsReached: false,
        memory: {
          knowledgeBaseContext: '',
          chatSummariesContext: ''
        },
        subGraph: {
          state: 'completed',
          name: 'hierarchical',
          prompt: '',
          response: ''
        },
        finalSummary: '',
        finalState: 'running',
        returnTo: null,
        // Planning context from PlannerNode
        planner: {
          goal: 'Help user learn React development',
          plan_steps: [
            'Research React learning resources',
            'Provide beginner-friendly tutorials',
            'Explain React concepts'
          ]
        }
      }
    };

    // ================================================================
    // CYCLE 1: First Reasoning → Action
    // ================================================================
    
    // Step 1: ReasoningNode analyzes situation
    const reasoning1 = await reasoningNode.execute(state);
    expect(reasoning1.decision.type).toBe('next');
    
    // Should have stored reasoning decision
    const decision1 = (reasoning1.state.metadata as any).reasoning?.currentDecision;
    expect(decision1).toBeDefined();
    expect(decision1.action_type).toBe('tool_call');
    expect(decision1.tool_name).toBe('web_search');
    expect(decision1.stop_condition_met).toBe(false);
    
    // Step 2: ActionNode executes the decided action
    state = reasoning1.state;
    const action1 = await actionNode.execute(state);
    expect(action1.decision.type).toBe('next');
    
    // Should have executed web search and stored results
    const actionResult1 = (action1.state.metadata as any).latestAction;
    expect(actionResult1).toBeDefined();
    expect(actionResult1.success).toBe(true);
    expect(actionResult1.tool_name).toBe('web_search');
    expect(actionResult1.result.query).toBe('React tutorials for beginners');
    
    // ================================================================
    // CYCLE 2: Second Reasoning → Complete
    // ================================================================
    
    // Step 3: ReasoningNode analyzes action results
    state = action1.state;
    // Add a message to simulate the action completion
    state.messages.push({
      role: 'assistant',
      content: 'Web search completed successfully. Found React tutorials.'
    });
    
    const reasoning2 = await reasoningNode.execute(state);
    
    // Should detect goal completion
    const decision2 = (reasoning2.state.metadata as any).reasoning?.currentDecision;
    expect(decision2).toBeDefined();
    expect(decision2.action_type).toBe('complete');
    expect(decision2.stop_condition_met).toBe(true);
    expect(reasoning2.decision.type).toBe('end'); // Should end the loop
    
    // ================================================================
    // VERIFY COMPLETE LOOP EXECUTION
    // ================================================================
    
    // Should have 1 complete action in history
    const allActions = (reasoning2.state.metadata as any).actions;
    expect(allActions).toHaveLength(1);
    expect(allActions[0].tool_name).toBe('web_search');
    expect(allActions[0].success).toBe(true);
    
    // Should have reasoning diagnostics from both cycles
    const reasoningData = (reasoning2.state.metadata as any).reasoning;
    expect(reasoningData?.diagnostics?.goalExtracted).toBe(true);
    expect(reasoningData?.diagnostics?.actionDecided).toBe(true);
    expect(reasoningData?.diagnostics?.stopConditionChecked).toBe(true);
  });

  test('should handle action failures gracefully in ReAct loop', async () => {
    const reasoningNode = new ReasoningNode();
    const actionNode = new ActionNode();
    
    const state: any = {
      messages: [
        { role: 'user', content: 'I need to process some data' }
      ],
      metadata: {
        action: 'use_tools',
        threadId: 'failure_test',
        wsChannel: 'test',
        llmModel: 'claude-3-haiku',
        llmLocal: false,
        cycleComplete: false,
        waitingForUser: false,
        options: {},
        currentNodeId: 'reasoning',
        consecutiveSameNode: 0,
        iterations: 0,
        revisionCount: 0,
        maxIterationsReached: false,
        memory: {
          knowledgeBaseContext: '',
          chatSummariesContext: ''
        },
        subGraph: {
          state: 'completed',
          name: 'hierarchical',
          prompt: '',
          response: ''
        },
        finalSummary: '',
        finalState: 'running',
        returnTo: null,
        planner: {
          goal: 'Process user data',
          plan_steps: ['Analyze data', 'Generate report']
        },
        // Inject a reasoning decision that will use non-existent tool
        reasoning: {
          currentDecision: {
            current_situation: 'Testing failure handling',
            goal_progress: '0% complete',
            next_action: 'Use non-existent tool',
            action_type: 'tool_call',
            tool_name: 'non_existent_tool',
            tool_parameters: { test: 'parameter' },
            reasoning: 'Testing error handling',
            confidence: 0.5,
            stop_condition_met: false
          }
        }
      }
    };

    // Execute ActionNode with failing tool
    const result = await actionNode.execute(state);
    
    // Should handle failure gracefully
    expect(result.decision.type).toBe('next');
    
    // Should record the failure
    const actionResult = (result.state.metadata as any).latestAction;
    expect(actionResult.success).toBe(false);
    expect(actionResult.error_message).toContain('not implemented');
    expect(actionResult.tool_name).toBe('non_existent_tool');
  });
});

console.log('🔄 REACT LOOP TEST - Reasoning + Action integration');
