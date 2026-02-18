/**
 * SkillGraph Reasoning Retry Scenario Test
 * 
 * Tests specifically the reasoning retry logic:
 * - Planner succeeds immediately (gets to ReAct loop)
 * - Reasoning fails first 2 attempts with missing currentDecision
 * - Succeeds on 3rd attempt with valid decision
 * - Should route to critic after reasoning success
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

// Mock LLM service - REASONING RETRY SCENARIO
const mockLLMService = {
    generateResponse: jest.fn().mockImplementation(async (prompt: string) => {

      // Plan Retrieval - Always succeeds (we want to get to reasoning)
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

      // Planner - Succeeds immediately (we want to test reasoning failures)
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

      // REASONING RETRY SCENARIO - Fail first 2 attempts, succeed on 3rd
      if (prompt.includes('Reasoning') || prompt.includes('ReAct') || prompt.includes('next_action')) {
        attemptCounts.reasoning++;
        console.log(`[TEST] Reasoning attempt #${attemptCounts.reasoning}`);

        if (attemptCounts.reasoning <= 2) {
          // First 2 attempts fail - return response without currentDecision
          console.log(`[TEST] Reasoning attempt ${attemptCounts.reasoning} - FAILING (no currentDecision)`);
          return {
            content: JSON.stringify({
              current_situation: 'Attempting to start project setup',
              goal_progress: 'Still analyzing requirements',
              reasoning: 'Unable to determine next step',
              confidence: 0.2,
              error: 'Failed to determine appropriate action'
              // Missing currentDecision = failure
            }),
            metadata: {
              tokens_used: 30,
              prompt_tokens: 25,
              completion_tokens: 5,
              time_spent: 600
            }
          };
        } else {
          // 3rd attempt succeeds with valid decision
          console.log(`[TEST] Reasoning attempt ${attemptCounts.reasoning} - SUCCESS (valid currentDecision)`);
          const reasoningResponse = {
            current_situation: 'Starting Node.js project setup',
            goal_progress: 'Initializing project structure',
            next_action: 'Create package.json file',
            action_type: 'complete', // Mark complete to test critic flow
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
      }

      // All other nodes succeed immediately (we're only testing reasoning retry)
      if (prompt.includes('Skill Critic')) {
        attemptCounts.critic++;
        console.log(`[TEST] Critic attempt #${attemptCounts.critic} - SUCCESS (immediate)`);
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
          summaryMessage: 'Node.js project setup completed after reasoning retries'
        };
        return {
          content: JSON.stringify(outputResponse),
          metadata: { tokens_used: 150, prompt_tokens: 80, completion_tokens: 70, time_spent: 1200 }
        };
      }

      return {
        content: JSON.stringify({ error: 'Unexpected prompt in reasoning retry test' }),
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
        remoteApiKey: 'test-key-reasoning-retry',
        remoteTimeoutSeconds: 30,
        remoteRetryCount: 3
      };
      return Promise.resolve(settings[key] ?? defaultValue);
    })
  }
}));

describe('SkillGraph Reasoning Retry Scenario', () => {
  
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

  describe('Reasoning Retry Logic', () => {
    it('should retry reasoning when it fails to provide currentDecision', async () => {
      console.log('\n🧠 Testing Reasoning Retry Logic - Should fail twice, succeed on 3rd attempt');
      
      const { graph, state } = await GraphRegistry.getOrCreateSkillGraph(
        'retry-test-reasoning',
        'reasoning-retry-thread'  
      ) as { graph: any; state: SkillGraphState };

      // Add test message  
      state.messages.push({
        role: 'user',
        content: 'Create a Node.js project with best practices'
      });

      // Execute graph - should get to reasoning node and trigger retries
      const finalState = await graph.execute(state);

      // Verify planner succeeded immediately (1 attempt)
      expect(attemptCounts.planner).toBe(1);
      console.log(`✅ Planner attempts: ${attemptCounts.planner} (expected: 1)`);

      // Verify reasoning was called 3 times (2 failures + 1 success)
      expect(attemptCounts.reasoning).toBe(3);
      console.log(`✅ Reasoning retry count: ${attemptCounts.reasoning} (expected: 3)`);

      // Verify reasoningRetries counter exists in state
      expect(finalState.metadata.reasoningRetries).toBe(2);
      
      // Verify ReAct loop continued to critic after reasoning success
      expect(attemptCounts.critic).toBeGreaterThan(0);
      console.log(`✅ Critic attempts: ${attemptCounts.critic} (ReAct loop continued)`);
      
      // Verify final state shows successful completion
      expect(finalState.metadata.reasoning).toBeDefined();
      expect(finalState.metadata.reasoning.currentDecision).toBeDefined();
      
      console.log('✅ Reasoning retry test passed - failed twice, succeeded on retry');
      console.log(`📊 Final counts: Planner: ${attemptCounts.planner}, Reasoning: ${attemptCounts.reasoning}, Critic: ${attemptCounts.critic}`);
    });
  });
});
