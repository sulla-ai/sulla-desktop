/**
 * SkillGraph Planner Retry Scenario Test
 * 
 * Tests specifically the planner retry logic:
 * - Planner fails first 2 attempts with empty plan_steps
 * - Succeeds on 3rd attempt with valid plan
 * - Should trigger ReAct loop after successful plan
 */

// Setup Node.js globals for Jest environment (required by dependencies)
import { TextEncoder, TextDecoder } from 'util';
// @ts-ignore
globalThis.TextEncoder = TextEncoder;
// @ts-ignore
globalThis.TextDecoder = TextDecoder;

// Setup crypto for Node.js environment
import { webcrypto } from 'crypto';
// @ts-ignore
globalThis.crypto = webcrypto;

// Setup web streams API for LangChain packages
import { ReadableStream, WritableStream, TransformStream } from 'stream/web';
// @ts-ignore
globalThis.ReadableStream = ReadableStream;
// @ts-ignore
globalThis.WritableStream = WritableStream;
// @ts-ignore
globalThis.TransformStream = TransformStream;

// Setup fetch API (required by many packages)
import fetch, { Headers, Request, Response } from 'node-fetch';
// @ts-ignore
globalThis.fetch = fetch;
// @ts-ignore
globalThis.Headers = Headers;
// @ts-ignore
globalThis.Request = Request;
// @ts-ignore
globalThis.Response = Response;

import { GraphRegistry } from '../../services/GraphRegistry';
import type { SkillGraphState } from '../Graph';

// Track attempt counts for each node type
const attemptCounts = {
  planner: 0,
  reasoning: 0,
  critic: 0
};

beforeEach(() => {
  // Reset attempt counters
  attemptCounts.planner = 0;
  attemptCounts.reasoning = 0;
  attemptCounts.critic = 0;
  
  // Clear all timers to prevent hanging
  jest.clearAllTimers();
});

// Mock LLM service - PLANNER RETRY SCENARIO
const mockLLMService = {
    generateResponse: jest.fn().mockImplementation(async (prompt: string) => {

      // Plan Retrieval - Always succeeds (we want to test planner failures)
      if (prompt.includes('Plan Retrieval')) {
        const planRetrievalResponse = {
          intent: 'development',
          goal: 'Create Node.js project with best practices',
          selected_skill_slug: null,
          memory_search: [],
          response_immediate: false // Force complex flow to trigger planner
        };
        
        return {
          content: JSON.stringify(planRetrievalResponse),
          metadata: {
            tokens_used: 150,
            prompt_tokens: 80,
            completion_tokens: 70,
            time_spent: 1200
          }
        };
      }

      // PLANNER RETRY SCENARIO - Fail first 2 attempts, succeed on 3rd
      if (prompt.includes('based on user goals') || prompt.includes('User Goal:') || prompt.includes('Response Format')) {
        attemptCounts.planner++;
        console.log(`[TEST] Planner attempt #${attemptCounts.planner}`);

        if (attemptCounts.planner <= 2) {
          // First 2 attempts fail - return malformed/empty response
          console.log(`[TEST] Planner attempt ${attemptCounts.planner} - FAILING (empty plan_steps)`);
          return {
            content: JSON.stringify({
              restated_goal: 'Create Node.js project with best practices',
              plan_steps: [], // Empty plan = failure
              complexity_score: 5,
              complexity_reasoning: 'Failed attempt',
              skill_focused: false,
              estimated_duration: '1 hour'
            }),
            metadata: {
              tokens_used: 50,
              prompt_tokens: 40,
              completion_tokens: 10,
              time_spent: 800
            }
          };
        } else {
          // 3rd attempt succeeds with valid plan
          console.log(`[TEST] Planner attempt ${attemptCounts.planner} - SUCCESS (valid plan)`);
          const plannerResponse = {
            restated_goal: 'Create Node.js project with best practices',
            skill_focused: true,
            plan_steps: ['Init package.json', 'Create src/', 'Setup tests'],
            complexity_score: 8,
            complexity_reasoning: 'Complex setup with multiple components',
            estimated_duration: '2-3 hours'
          };
          
          return {
            content: JSON.stringify(plannerResponse),
            metadata: {
              tokens_used: 200,
              prompt_tokens: 120,
              completion_tokens: 80,
              time_spent: 1500
            }
          };
        }
      }

      // All other nodes succeed immediately (we're only testing planner retry)
      if (prompt.includes('Reasoning')) {
        attemptCounts.reasoning++;
        const reasoningResponse = {
          current_situation: 'Starting Node.js project setup',
          goal_progress: 'Initializing project structure',
          next_action: 'Create package.json file',
          action_type: 'complete',
          reasoning: 'Package.json is the foundation',
          confidence: 0.9,
          stop_condition_met: true
        };
        return {
          content: JSON.stringify(reasoningResponse),
          metadata: { tokens_used: 150, prompt_tokens: 80, completion_tokens: 70, time_spent: 1200 }
        };
      }

      if (prompt.includes('Skill Critic')) {
        attemptCounts.critic++;
        const criticResponse = {
          progressScore: 9,
          evidenceScore: 8,
          decision: 'complete',
          reason: 'Successfully completed with sufficient evidence',
          nextAction: 'Project ready for use',
          completionJustification: 'All steps executed and verified'
        };
        return {
          content: JSON.stringify(criticResponse),
          metadata: { tokens_used: 150, prompt_tokens: 80, completion_tokens: 70, time_spent: 1200 }
        };
      }

      if (prompt.includes('Output')) {
        const outputResponse = {
          taskStatus: 'completed',
          completionScore: 8,
          summaryMessage: 'Node.js project setup completed after planner retries'
        };
        return {
          content: JSON.stringify(outputResponse),
          metadata: { tokens_used: 150, prompt_tokens: 80, completion_tokens: 70, time_spent: 1200 }
        };
      }

      return {
        content: JSON.stringify({ error: 'Unexpected prompt in planner retry test' }),
        metadata: { tokens_used: 50, prompt_tokens: 40, completion_tokens: 10, time_spent: 500 }
      };
    })
};

jest.mock('../../languagemodels', () => ({
  getCurrentModel: jest.fn().mockResolvedValue('claude-3-haiku'),
  getCurrentMode: jest.fn().mockResolvedValue('remote'),
  getLLMService: jest.fn().mockImplementation(() => mockLLMService),
  getService: jest.fn().mockImplementation(() => Promise.resolve(mockLLMService))
}));

// Mock tool registry
jest.mock('../../tools', () => ({
  toolRegistry: {
    getCategoriesWithDescriptions: jest.fn(() => [
      { category: 'file_operations', description: 'File and directory operations' },
      { category: 'web_research', description: 'Web search and data retrieval' }
    ]),
    getToolsByCategory: jest.fn(() => ['create_file', 'web_search']),
    getLLMToolsFor: jest.fn(() => []),
    getAllTools: jest.fn(() => [])
  }
}));

// Mock settings
jest.mock('../../database/models/SullaSettingsModel', () => ({
  SullaSettingsModel: {
    get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
      const settings: Record<string, any> = {
        modelMode: 'remote',
        remoteModel: 'claude-3-haiku',
        remoteProvider: 'anthropic',
        remoteApiKey: 'test-key-planner-retry',
        remoteTimeoutSeconds: 30,
        remoteRetryCount: 3
      };
      return Promise.resolve(settings[key] ?? defaultValue);
    })
  }
}));

describe('SkillGraph Planner Retry Scenario', () => {
  
  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    attemptCounts.planner = 0;
    attemptCounts.reasoning = 0;  
    attemptCounts.critic = 0;
  });

  describe('Planner Retry Logic', () => {
    it('should retry planner when it fails with empty plan_steps', async () => {
      console.log('\n🔄 Testing Planner Retry Logic - Should fail twice, succeed on 3rd attempt');
      
      const { graph, state } = await GraphRegistry.getOrCreateSkillGraph(
        'retry-test-planner',
        'planner-retry-thread'
      ) as { graph: any; state: SkillGraphState };

      // Add test message
      state.messages.push({
        role: 'user',
        content: 'Create a Node.js project with best practices'
      });

      // Execute graph - should trigger planner retries
      const finalState = await graph.execute(state);

      // Verify planner was called 3 times (2 failures + 1 success)  
      expect(attemptCounts.planner).toBe(3);
      console.log(`✅ Planner retry count: ${attemptCounts.planner} (expected: 3)`);

      // Verify final state shows successful completion
      expect(finalState.metadata.planner).toBeDefined();
      expect(finalState.metadata.planner.plan_steps).toHaveLength(3);
      expect(finalState.metadata.planner.plan_steps).toEqual(['Init package.json', 'Create src/', 'Setup tests']);
      
      // Verify plannerRetries counter exists in state  
      expect(finalState.metadata.plannerRetries).toBe(2);
      
      // Verify ReAct loop was triggered after successful plan
      expect(attemptCounts.reasoning).toBeGreaterThan(0);
      expect(attemptCounts.critic).toBeGreaterThan(0);
      
      console.log('✅ Planner retry test passed - retried and eventually succeeded');
      console.log(`📊 Final counts: Planner: ${attemptCounts.planner}, Reasoning: ${attemptCounts.reasoning}, Critic: ${attemptCounts.critic}`);
    });
  });
});
