/**
 * SkillGraph Critic Retry Scenario Test
 * 
 * Tests specifically the critic retry logic:
 * - Planner and reasoning succeed immediately (gets to critic)
 * - Critic rejects first attempt with 'continue' decision
 * - Reasoning runs again, critic accepts second time with 'complete' decision
 * - Should complete successfully after critic validation
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

// Mock LLM service - CRITIC RETRY SCENARIO
const mockLLMService = {
    generateResponse: jest.fn().mockImplementation(async (prompt: string) => {

      // Plan Retrieval - Always succeeds (we want to get to critic)
      if (prompt.includes('Plan Retrieval')) {
        const planRetrievalResponse = {
          intent: 'development',
          goal: 'Create Node.js project with best practices',
          selected_skill_slug: null,
          memory_search: [],
          response_immediate: false // Force complex flow to trigger ReAct loop
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

      // Planner - Succeeds immediately (we want to get to ReAct loop)
      if (prompt.includes('based on user goals') || prompt.includes('User Goal:') || prompt.includes('Response Format')) {
        attemptCounts.planner++;
        console.log(`[TEST] Planner attempt #${attemptCounts.planner} - SUCCESS (immediate)`);
        
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

      // Reasoning - Succeeds immediately (we want to get to critic)
      if (prompt.includes('Reasoning') || prompt.includes('ReAct') || prompt.includes('next_action')) {
        attemptCounts.reasoning++;
        console.log(`[TEST] Reasoning attempt #${attemptCounts.reasoning} - SUCCESS (immediate)`);
        
        const reasoningResponse = {
          current_situation: 'Starting Node.js project setup',
          goal_progress: 'Initializing project structure',
          next_action: 'Create package.json file',
          action_type: 'complete', // Mark complete to trigger critic
          reasoning: 'Package.json is the foundation',
          confidence: 0.9,
          stop_condition_met: true,
          currentDecision: {
            action: 'create_package_json',
            reasoning: 'Initialize project with package.json',
            expected_outcome: 'package.json file created'
          }
        };
        return {
          content: JSON.stringify(reasoningResponse),
          metadata: {
            tokens_used: 150,
            prompt_tokens: 80,
            completion_tokens: 70,
            time_spent: 1200
          }
        };
      }

      // CRITIC RETRY SCENARIO - Reject first attempt, accept second
      if (prompt.includes('Skill Critic') || prompt.includes('evaluate') || prompt.includes('progress')) {
        attemptCounts.critic++;
        console.log(`[TEST] Critic attempt #${attemptCounts.critic}`);

        if (attemptCounts.critic === 1) {
          // First critic attempt - REJECT completion claim
          console.log(`[TEST] Critic attempt ${attemptCounts.critic} - REJECTING (send back to reasoning)`);
          const criticResponse = {
            progressScore: 4,
            evidenceScore: 3,
            decision: 'continue', // Tell graph to continue working
            reason: 'Insufficient evidence of task completion',
            nextAction: 'Need more verification steps',
            completionJustification: 'Task appears incomplete - needs more work',
            emit_chat_message: 'More work needed - continuing'
          };
          return {
            content: JSON.stringify(criticResponse),
            metadata: {
              tokens_used: 120,
              prompt_tokens: 70,
              completion_tokens: 50,
              time_spent: 1000
            }
          };
        } else {
          // Second critic attempt - ACCEPT completion
          console.log(`[TEST] Critic attempt ${attemptCounts.critic} - ACCEPTING (allow completion)`);
          const criticResponse = {
            progressScore: 9,
            evidenceScore: 8,
            decision: 'complete',
            reason: 'Successfully completed with sufficient evidence',
            nextAction: 'Project ready for use',
            completionJustification: 'All steps executed and verified',
            emit_chat_message: 'Task completed successfully after validation'
          };
          return {
            content: JSON.stringify(criticResponse),
            metadata: {
              tokens_used: 150,
              prompt_tokens: 80,
              completion_tokens: 70,
              time_spent: 1200
            }
          };
        }
      }

      // Output - Always succeed (final step)
      if (prompt.includes('Output')) {
        const outputResponse = {
          taskStatus: 'completed',
          completionScore: 8,
          summaryMessage: 'Node.js project setup completed after critic validation'
        };
        return {
          content: JSON.stringify(outputResponse),
          metadata: { tokens_used: 150, prompt_tokens: 80, completion_tokens: 70, time_spent: 1200 }
        };
      }

      return {
        content: JSON.stringify({ error: 'Unexpected prompt in critic retry test' }),
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
        remoteApiKey: 'test-key-critic-retry',
        remoteTimeoutSeconds: 30,
        remoteRetryCount: 3
      };
      return Promise.resolve(settings[key] ?? defaultValue);
    })
  }
}));

describe('SkillGraph Critic Retry Scenario', () => {
  
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

  describe('Critic Retry Logic', () => {
    it('should handle critic rejection and re-route through ReAct loop', async () => {
      console.log('\n🎯 Testing Critic Retry Logic - Should reject first, accept second');
      
      const { graph, state } = await GraphRegistry.getOrCreateSkillGraph(
        'retry-test-critic',
        'critic-retry-thread'
      ) as { graph: any; state: SkillGraphState };

      state.messages.push({
        role: 'user', 
        content: 'Create a Node.js project with best practices'
      });

      const finalState = await graph.execute(state);

      // Verify planner succeeded immediately (1 attempt)
      expect(attemptCounts.planner).toBe(1);
      console.log(`✅ Planner attempts: ${attemptCounts.planner} (expected: 1)`);

      // Verify reasoning was called at least twice (due to critic rejection)
      expect(attemptCounts.reasoning).toBeGreaterThan(1);
      console.log(`✅ Reasoning attempts: ${attemptCounts.reasoning} (expected: >1 due to critic rejection)`);

      // Verify critic was called multiple times (rejection then acceptance)
      expect(attemptCounts.critic).toBe(2);
      console.log(`✅ Critic attempt count: ${attemptCounts.critic} (expected: 2)`);

      // Verify no bypass - action should have routed through critic
      expect(finalState.metadata.skillCritic).toBeDefined();
      expect(finalState.metadata.skillCritic.decision).toBe('complete');
      
      // Verify critic rejection triggered additional reasoning cycles
      expect(finalState.metadata.reactLoopCount).toBeGreaterThan(1);
      
      console.log('✅ Critic retry test passed - proper routing and validation');
      console.log(`📊 Final counts: Planner: ${attemptCounts.planner}, Reasoning: ${attemptCounts.reasoning}, Critic: ${attemptCounts.critic}`);
      console.log(`🔄 ReAct loops: ${finalState.metadata.reactLoopCount} (critic rejection caused additional cycles)`);
    });
  });
});
