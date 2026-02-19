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
    chat: jest.fn().mockImplementation(async (messages: any[], options?: any) => {
      // Extract system prompt to determine which node is calling
      const systemMsg = [...messages].reverse().find((m: any) => m.role === 'system');
      const prompt = systemMsg?.content || messages.map((m: any) => m.content).join(' ');

      // Plan Retrieval - Always succeeds (we want to get to reasoning)
      if (prompt.includes('specialized planning') || prompt.includes('intent analysis')) {
        return {
          content: JSON.stringify({
            intent: 'development',
            goal: 'Create Node.js project with best practices',
            selected_skill_slug: null,
            memory_search: [],
          }),
          metadata: { tokens_used: 150, prompt_tokens: 80, completion_tokens: 70, time_spent: 1200 }
        };
      }

      // Planner - Succeeds immediately (we want to test reasoning failures)
      if (prompt.includes('planning AI') || prompt.includes('actionable plans') || prompt.includes('SELECTED SOP SKILL') || prompt.includes('SOP execution') || prompt.includes('strategic planning') || prompt.includes('based on user goals')) {
        attemptCounts.planner++;
        console.log(`[TEST] Planner attempt #${attemptCounts.planner} - SUCCESS (immediate)`);
        return {
          content: 'RESPONSE: PLAN\n\nGoal: Create Node.js project with best practices\n\n1. [ ] Init package.json\n2. [ ] Create src/\n3. [ ] Setup tests',
          metadata: { tokens_used: 200, prompt_tokens: 120, completion_tokens: 80, time_spent: 1500 }
        };
      }

      // REASONING RETRY SCENARIO - Fail first 2 attempts, succeed on 3rd
      if (prompt.includes('ReAct reasoning agent')) {
        attemptCounts.reasoning++;
        console.log(`[TEST] Reasoning attempt #${attemptCounts.reasoning}`);

        if (attemptCounts.reasoning <= 2) {
          // First 2 attempts fail - return null (LLM failure)
          console.log(`[TEST] Reasoning attempt ${attemptCounts.reasoning} - FAILING (null response)`);
          return null;
        } else {
          // 3rd attempt succeeds with valid STATUS response
          console.log(`[TEST] Reasoning attempt ${attemptCounts.reasoning} - SUCCESS (STATUS: COMPLETE)`);
          return {
            content: `STATUS: COMPLETE\n\n## Updated Plan\n1. [DONE] Init package.json\n2. [DONE] Create src/\n3. [DONE] Setup tests\n\nAll steps completed successfully.`,
            metadata: { tokens_used: 150, prompt_tokens: 80, completion_tokens: 70, time_spent: 1200 }
          };
        }
      }

      // Action Node
      if (prompt.includes('Execute the next steps')) {
        return {
          content: 'Executed plan steps successfully. Created package.json, set up src directory, and configured tests.',
          metadata: { tokens_used: 150, prompt_tokens: 80, completion_tokens: 70, time_spent: 1200 }
        };
      }

      // Skill Critic
      if (prompt.includes('Skill Critic') || prompt.includes('evaluate') || prompt.includes('progress')) {
        attemptCounts.critic++;
        console.log(`[TEST] Critic attempt #${attemptCounts.critic} - SUCCESS (immediate)`);
        return {
          content: JSON.stringify({
            progressScore: 9,
            evidenceScore: 8,
            decision: 'complete',
            reason: 'Successfully completed with sufficient evidence',
            nextAction: 'Project ready for use',
            completionJustification: 'All steps executed and verified'
          }),
          metadata: { tokens_used: 150, prompt_tokens: 80, completion_tokens: 70, time_spent: 1200 }
        };
      }

      // Output
      if (prompt.includes('Output') || prompt.includes('summary') || prompt.includes('final')) {
        return {
          content: JSON.stringify({
            taskStatus: 'completed',
            completionScore: 8,
            summaryMessage: 'Node.js project setup completed after reasoning retries'
          }),
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
  getService: jest.fn().mockImplementation(() => Promise.resolve(mockLLMService)),
  getLocalService: jest.fn().mockImplementation(async () => ({ isAvailable: () => false }))
}));

// Mock WebSocket to prevent real connection attempts
jest.mock('../../services/WebSocketClientService', () => ({
  getWebSocketClientService: () => ({
    send: jest.fn(),
    isConnected: jest.fn(() => true)
  })
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

      // Verify final state shows successful completion
      expect(finalState.metadata.reasoning).toBeDefined();
      expect(finalState.metadata.reasoning.isComplete).toBe(true);

      console.log('✅ Reasoning retry test passed - failed twice, succeeded on retry');
      console.log(`📊 Final counts: Planner: ${attemptCounts.planner}, Reasoning: ${attemptCounts.reasoning}`);
    }, 30000);
  });
});
