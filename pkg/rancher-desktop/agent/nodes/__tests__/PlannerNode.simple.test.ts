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
      getActivePlans: jest.fn(() => Promise.resolve([])),
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
      // PlannerNode expects chat to return string content (no JSON parsing)
      return 'RESPONSE: PLAN\n\nGoal: Create a simple React application\n\n1. [ ] Set up React project with create-react-app\n2. [ ] Create basic component structure\n3. [ ] Add styling and layout\n4. [ ] Test the application';
    }

    async appendToolResultMessage(state: any, toolName: string, result: any) {
      state.messages.push({
        role: 'tool',
        content: JSON.stringify({ toolName, result })
      });
    }

    findLatestUserMessage(messages: any[]) {
      return messages.find(m => m.role === 'user');
    }
  }
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
        }
      }
    };

    // Execute the node
    const result = await plannerNode.execute(state);

    // Basic assertions
    expect(result).toBeDefined();
    expect(result.decision.type).toBe('next');
    expect(result.state.messages.length).toBeGreaterThanOrEqual(3); // Original user + plan summary + tool result

    // Check that plan was generated and stored in metadata
    const metadata = result.state.metadata as any;
    expect(metadata.planner).toBeDefined();
    expect(metadata.planner.diagnostics.goalExtracted).toBe(true);
    expect(metadata.planner.diagnostics.planGenerated).toBe(true);

    // textPlan should be stored in reasoning metadata
    expect(metadata.reasoning?.textPlan).toBeDefined();
    expect(metadata.reasoning.textPlan).toContain('React');
  });

  test('should generate skill-focused plan with SOP compliance', async () => {
    const plannerNode = new PlannerNode();

    // Override mock to return skill-focused plan (plain text, not JSON)
    (plannerNode as any).chat = jest.fn().mockResolvedValue(
      'RESPONSE: PLAN\n\nGoal: Create a new user account following company SOP\n\n1. [ ] Verify user permissions and authorization\n2. [ ] Collect required user information per policy\n3. [ ] Create account in Active Directory\n4. [ ] Assign default security groups\n5. [ ] Send welcome email with login instructions'
    );

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
    expect(result.state.messages.length).toBeGreaterThanOrEqual(3); // Original user + plan summary + tool result

    // Check skill-focused planning diagnostics
    const metadata = result.state.metadata as any;
    expect(metadata.planner).toBeDefined();
    expect(metadata.planner.diagnostics.skillDetected).toBe(true);
    expect(metadata.planner.diagnostics.planGenerated).toBe(true);

    // textPlan stored in reasoning
    expect(metadata.reasoning?.textPlan).toBeDefined();
    expect(metadata.reasoning.textPlan).toContain('user account');
  });
});

console.log('SIMPLE PLANNER NODE TEST - 2 scenarios');
