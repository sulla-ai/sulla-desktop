/**
 * Simple Test for PlannerNode - Starting Small
 * Single test to verify basic plan generation works
 */

import { PlannerNode } from '../PlannerNode';
import type { BaseThreadState } from '../Graph';
import type { ChatMessage } from '../../languagemodels/BaseLanguageModel';

// Mock ActivePlanManager to avoid complex plan management dependencies
jest.mock('../ActivePlanManager', () => ({
  ActivePlanManager: {
    getInstance: jest.fn(() => ({
      findExistingPlansForSkill: jest.fn(() => Promise.resolve([])),
      registerActivePlan: jest.fn(() => Promise.resolve({ success: true, planId: 'plan_123' })),
      monitorPlan: jest.fn(() => Promise.resolve())
    }))
  }
}));

// Mock BaseNode LLM calls for plan generation
jest.mock('../BaseNode', () => ({
  BaseNode: class MockBaseNode {
    constructor(public id: string, public name: string) {}
    
    async chat() {
      return Promise.resolve({
        content: JSON.stringify({
          restated_goal: 'Create a simple React application',
          plan_steps: [
            'Step 1: Set up React project with create-react-app',
            'Step 2: Create basic component structure',
            'Step 3: Add styling and layout',
            'Step 4: Test the application'
          ],
          complexity_score: 4,
          complexity_reasoning: 'Moderate complexity due to multiple setup steps and testing requirements',
          skill_focused: false,
          estimated_duration: '2-3 hours'
        })
      });
    }
    
    async appendToolResultMessage(state: any, toolName: string, result: any) {
      // Mock implementation - just add to messages
      state.messages.push({
        role: 'tool',
        content: JSON.stringify({ toolName, result })
      });
    }
    
    findLatestUserMessage(messages: any[]) {
      return messages.find(m => m.role === 'user');
    }
  },
  JSON_ONLY_RESPONSE_INSTRUCTIONS: 'Mock JSON instructions'
}));

describe('PlannerNode Simple Test', () => {
  
  test('should generate a basic action plan from goal and context', async () => {
    const plannerNode = new PlannerNode();
    
    // Create minimal state with planning context from PlanRetrievalNode
    const state: any = {
      messages: [
        { role: 'user', content: 'I want to build a React application' }
      ],
      metadata: {
        action: 'direct_answer',
        threadId: 'test_123',
        wsChannel: 'test',
        llmModel: 'claude-3-haiku',
        llmLocal: false,
        cycleComplete: false,
        waitingForUser: false,
        options: {},
        currentNodeId: 'planner',
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
        // Planning context from PlanRetrievalNode
        planRetrieval: {
          intent: 'application_development',
          goal: 'Build a React application for learning purposes',
          selected_skill_slug: null,
          response_immediate: false
        }
      }
    };

    // Execute the node
    const result = await plannerNode.execute(state);

    // Basic assertions
    expect(result).toBeDefined();
    expect(result.decision.type).toBe('next');
    expect(result.state.messages).toHaveLength(3); // Original + plan summary + tool result
    
    // Check that plan was generated and stored in metadata
    const metadata = result.state.metadata as any;
    expect(metadata.planner).toBeDefined();
    expect(metadata.planner.diagnostics.goalExtracted).toBe(true);
    expect(metadata.planner.diagnostics.planGenerated).toBe(true);
    expect(metadata.planner.diagnostics.planStepsCount).toBeGreaterThan(0);
    
    // Should have extracted goal from planRetrieval context
    expect(metadata.planner.diagnostics.complexityScored).toBe(true);
  });

  test('should generate skill-focused plan with SOP compliance', async () => {
    const plannerNode = new PlannerNode();
    
    // Override mock to return skill-focused plan
    (plannerNode as any).chat = jest.fn().mockResolvedValue({
      content: JSON.stringify({
        restated_goal: 'Create a new user account following company SOP',
        plan_steps: [
          'Step 1: Verify user permissions and authorization',
          'Step 2: Collect required user information per policy',
          'Step 3: Create account in Active Directory',
          'Step 4: Assign default security groups',
          'Step 5: Send welcome email with login instructions'
        ],
        complexity_score: 6,
        complexity_reasoning: 'Higher complexity due to security requirements and SOP compliance steps',
        skill_focused: true,
        estimated_duration: '30-45 minutes'
      })
    });
    
    const state: any = {
      messages: [
        { role: 'user', content: 'I need to create a user account for our new team member' }
      ],
      metadata: {
        action: 'direct_answer',
        threadId: 'test_skill_focused',
        wsChannel: 'test',
        llmModel: 'claude-3-haiku',
        llmLocal: false,
        cycleComplete: false,
        waitingForUser: false,
        options: {},
        currentNodeId: 'planner',
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
        // Planning context with selected skill
        planRetrieval: {
          intent: 'user_management',
          goal: 'Create user account following SOP procedures',
          selected_skill_slug: 'user-management',
          response_immediate: false,
          skillData: {
            title: 'User Management SOP',
            content: 'Standard operating procedure for creating user accounts...',
            slug: 'user-management'
          }
        }
      }
    };

    // Execute the node
    const result = await plannerNode.execute(state);

    // Should generate skill-focused plan with SOP compliance
    expect(result.decision.type).toBe('next');
    expect(result.state.messages).toHaveLength(3); // Original + plan summary + tool result
    
    // Check skill-focused planning diagnostics
    const metadata = result.state.metadata as any;
    expect(metadata.planner).toBeDefined();
    expect(metadata.planner.diagnostics.skillDetected).toBe(true);
    expect(metadata.planner.diagnostics.planGenerated).toBe(true);
    expect(metadata.planner.diagnostics.planStepsCount).toBe(5);
    expect(metadata.planner.diagnostics.complexityScored).toBe(true);
  });
});

console.log('✅ SIMPLE PLANNER NODE TEST - 2 scenarios');
