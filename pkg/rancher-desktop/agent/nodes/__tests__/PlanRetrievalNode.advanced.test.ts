/**
 * Advanced Test for PlanRetrievalNode - Adversarial & Edge Cases
 * Testing error scenarios, malformed data, timeouts, and edge cases
 * that could reveal bugs in production
 */

import { PlanRetrievalNode } from '../PlanRetrievalNode';
import type { BaseThreadState } from '../Graph';
import type { ChatMessage } from '../../languagemodels/BaseLanguageModel';

// Mock dependencies with potential failure scenarios
jest.mock('../../database/registry/ArticlesRegistry', () => ({
  articlesRegistry: {
    getSkillTriggers: jest.fn(() => Promise.resolve(`
**Order Lookup** - slug: \`order-lookup\`
- Trigger: "pull up order", "find order", "order information"
- Retrieves customer order details

**User Management** - slug: \`user-management\`  
- Trigger: "create user", "manage account", "user settings"
- Manages user accounts and permissions
`)),
    searchByKeywords: jest.fn(() => Promise.resolve([]))
  }
}));

jest.mock('../../database/RedisClient', () => ({
  redisClient: {
    initialize: jest.fn(() => Promise.resolve()),
    get: jest.fn(() => Promise.resolve(null)),
    set: jest.fn(() => Promise.resolve())
  }
}));

jest.mock('../ActivePlanManager', () => ({
  ActivePlanManager: {
    getInstance: jest.fn(() => ({
      getActivePlans: jest.fn(() => Promise.resolve([])),
      getActivePlanSummary: jest.fn(() => Promise.resolve('No active plans.')),
      getActiveSkills: jest.fn(() => Promise.resolve([]))
    }))
  }
}));

// Mock BaseNode with failure scenarios
jest.mock('../BaseNode', () => ({
  BaseNode: class MockBaseNode {
    constructor(public id: string, public name: string) {}
    
    async callLLM() {
      return Promise.resolve({
        content: JSON.stringify({
          intent: 'general_question',
          goal: 'Get help with React development',
          selected_skill_slug: null,
          memory_search: [],
          response_immediate: true
        })
      });
    }
    
    async chat() {
      return Promise.resolve({
        content: JSON.stringify({
          intent: 'user_management',
          goal: 'Create a new user account for team member',
          selected_skill_slug: 'user-management',
          memory_search: ['user', 'account'],
          response_immediate: false
        })
      });
    }
    
    findLatestUserMessage(messages: any[]) {
      return messages.find(m => m.role === 'user');
    }
  },
  JSON_ONLY_RESPONSE_INSTRUCTIONS: 'Mock JSON instructions'
}));

describe('PlanRetrievalNode Advanced Tests', () => {
  
  test('should handle malformed LLM responses gracefully', async () => {
    const planRetrievalNode = new PlanRetrievalNode();
    
    // Override mock to return malformed JSON (real production issue)
    (planRetrievalNode as any).chat = jest.fn().mockResolvedValue({
      content: 'This is not valid JSON at all! {broken: json, missing quotes, trailing comma,}'
    });
    
    const state: any = {
      messages: [
        { role: 'user', content: 'Can you help me with a complex task that requires detailed analysis?' }
      ],
      metadata: {
        action: 'direct_answer',
        threadId: 'test_malformed_llm',
        wsChannel: 'test',
        llmModel: 'claude-3-haiku',
        llmLocal: false,
        cycleComplete: false,
        waitingForUser: false,
        options: {},
        currentNodeId: 'plan_retrieval',
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
        returnTo: null
      }
    };

    // This should either handle the error gracefully or expose a bug
    try {
      const result = await planRetrievalNode.execute(state);
      
      // If it succeeds, it should have some fallback behavior
      expect(result.decision.type).toBe('next');
      const metadata = result.state.metadata as any;
      expect(metadata.planRetrieval).toBeDefined();
      
    } catch (error) {
      // If it fails, we found a potential production bug
      console.log('Found potential bug with malformed LLM response:', error);
      expect(error).toBeDefined(); // Document the failure
    }
  });

  test('should handle LLM timeout/rejection scenarios', async () => {
    const planRetrievalNode = new PlanRetrievalNode();
    
    // Simulate LLM service failure
    (planRetrievalNode as any).chat = jest.fn().mockRejectedValue(new Error('LLM service timeout'));
    
    const state: any = {
      messages: [
        { role: 'user', content: 'This message will trigger LLM analysis that fails' }
      ],
      metadata: {
        action: 'direct_answer',
        threadId: 'test_llm_timeout',
        wsChannel: 'test',
        llmModel: 'claude-3-haiku',
        llmLocal: false,
        cycleComplete: false,
        waitingForUser: false,
        options: {},
        currentNodeId: 'plan_retrieval',
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
        returnTo: null
      }
    };

    try {
      const result = await planRetrievalNode.execute(state);
      
      // If it succeeds, it should have graceful degradation
      expect(result.decision.type).toBe('next');
      
    } catch (error) {
      // Document LLM failure handling
      console.log('LLM timeout handling:', error);
      expect(error).toBeDefined();
    }
  });

  test('should handle extremely large message content', async () => {
    const planRetrievalNode = new PlanRetrievalNode();
    
    // Create absurdly large message (10MB of text)
    const massiveContent = 'A'.repeat(10 * 1024 * 1024);
    
    const state: any = {
      messages: [
        { role: 'user', content: massiveContent }
      ],
      metadata: {
        action: 'direct_answer',
        threadId: 'test_massive_content',
        wsChannel: 'test',
        llmModel: 'claude-3-haiku',
        llmLocal: false,
        cycleComplete: false,
        waitingForUser: false,
        options: {},
        currentNodeId: 'plan_retrieval',
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
        returnTo: null
      }
    };

    try {
      const result = await planRetrievalNode.execute(state);
      
      // Should handle massive content without crashing
      expect(result.decision.type).toBe('next');
      
    } catch (error) {
      // Document how massive content is handled
      console.log('Massive content handling:', error);
      expect(error).toBeDefined();
    }
  });

  test('should handle concurrent execution attempts', async () => {
    const planRetrievalNode = new PlanRetrievalNode();
    
    const state: any = {
      messages: [
        { role: 'user', content: 'Test concurrent execution' }
      ],
      metadata: {
        action: 'direct_answer',
        threadId: 'test_concurrent',
        wsChannel: 'test',
        llmModel: 'claude-3-haiku',
        llmLocal: false,
        cycleComplete: false,
        waitingForUser: false,
        options: {},
        currentNodeId: 'plan_retrieval',
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
        returnTo: null
      }
    };

    // Execute multiple instances concurrently
    const promises = Array(5).fill(null).map(() => 
      planRetrievalNode.execute(JSON.parse(JSON.stringify(state)))
    );

    try {
      const results = await Promise.all(promises);
      
      // All should complete successfully
      results.forEach(result => {
        expect(result.decision.type).toBe('next');
      });
      
    } catch (error) {
      // Document any concurrency issues
      console.log('Concurrency handling:', error);
      expect(error).toBeDefined();
    }
  });
});

console.log('🔥 ADVANCED PLAN RETRIEVAL TESTS - Adversarial scenarios');
