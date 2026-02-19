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
    chat: jest.fn().mockImplementation(async (messages: any[], options?: any) => {
      // Extract system prompt to determine which node is calling
      const systemMsg = [...messages].reverse().find((m: any) => m.role === 'system');
      const prompt = systemMsg?.content || messages.map((m: any) => m.content).join(' ');

      // Plan Retrieval - Always succeeds
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

      // Planner - Succeeds immediately (returns text, not JSON)
      if (prompt.includes('planning AI') || prompt.includes('actionable plans') || prompt.includes('SELECTED SOP SKILL') || prompt.includes('SOP execution') || prompt.includes('strategic planning') || prompt.includes('based on user goals')) {
        attemptCounts.planner++;
        console.log(`[TEST] Planner attempt #${attemptCounts.planner} - SUCCESS (immediate)`);
        return {
          content: 'RESPONSE: PLAN\n\nGoal: Create Node.js project with best practices\n\n1. [ ] Init package.json\n2. [ ] Create src/\n3. [ ] Setup tests',
          metadata: { tokens_used: 200, prompt_tokens: 120, completion_tokens: 80, time_spent: 1500 }
        };
      }

      // Reasoning - Always succeeds with CONTINUE to reach critic
      if (prompt.includes('ReAct reasoning agent')) {
        attemptCounts.reasoning++;
        console.log(`[TEST] Reasoning attempt #${attemptCounts.reasoning} - SUCCESS (STATUS: CONTINUE)`);
        return {
          content: `STATUS: CONTINUE\n\n## Updated Plan\n1. [ ] Init package.json <- NEXT\n2. [ ] Create src/\n3. [ ] Setup tests\n\nProceeding with package.json creation.`,
          metadata: { tokens_used: 150, prompt_tokens: 80, completion_tokens: 70, time_spent: 1200 }
        };
      }

      // Action Node
      if (prompt.includes('Execute the next steps')) {
        return {
          content: 'Executed plan steps. Created package.json with project configuration.',
          metadata: { tokens_used: 150, prompt_tokens: 80, completion_tokens: 70, time_spent: 1200 }
        };
      }

      // CRITIC RETRY SCENARIO - Reject first attempt, accept second
      if (prompt.includes('Skill Critic') || prompt.includes('evaluate') || prompt.includes('progress')) {
        attemptCounts.critic++;
        console.log(`[TEST] Critic attempt #${attemptCounts.critic}`);

        if (attemptCounts.critic === 1) {
          console.log(`[TEST] Critic attempt ${attemptCounts.critic} - REJECTING (send back to reasoning)`);
          return {
            content: JSON.stringify({
              progressScore: 4,
              evidenceScore: 3,
              decision: 'continue',
              reason: 'Insufficient evidence of task completion',
              nextAction: 'Need more verification steps',
              completionJustification: 'Task appears incomplete - needs more work',
              emit_chat_message: 'More work needed - continuing'
            }),
            metadata: { tokens_used: 120, prompt_tokens: 70, completion_tokens: 50, time_spent: 1000 }
          };
        } else {
          console.log(`[TEST] Critic attempt ${attemptCounts.critic} - ACCEPTING (allow completion)`);
          return {
            content: JSON.stringify({
              progressScore: 9,
              evidenceScore: 8,
              decision: 'complete',
              reason: 'Successfully completed with sufficient evidence',
              nextAction: 'Project ready for use',
              completionJustification: 'All steps executed and verified',
              emit_chat_message: 'Task completed successfully after validation'
            }),
            metadata: { tokens_used: 150, prompt_tokens: 80, completion_tokens: 70, time_spent: 1200 }
          };
        }
      }

      // Output
      if (prompt.includes('Output') || prompt.includes('summary') || prompt.includes('final')) {
        return {
          content: JSON.stringify({
            taskStatus: 'completed',
            completionScore: 8,
            summaryMessage: 'Node.js project setup completed after critic validation'
          }),
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
    }, 30000);
  });
});
