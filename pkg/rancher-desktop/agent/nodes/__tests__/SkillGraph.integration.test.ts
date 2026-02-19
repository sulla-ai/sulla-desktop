/**
 * INTEGRATION Test for SkillGraph - Full Graph Execution with Real Components
 * Tests actual graph routing behavior that production uses.
 *
 * Mock strategy: We mock at the BaseLanguageModel level via getService(),
 * intercepting LLM calls AFTER prompt construction but BEFORE network requests.
 * This gives us access to the actual system prompts nodes send, and lets us
 * return proper NormalizedResponse objects without dealing with raw HTTP.
 */

// Setup Node.js globals for production compatibility (required by dependencies)
import { TextEncoder, TextDecoder } from 'util';
import { webcrypto } from 'crypto';
import { ReadableStream, WritableStream, TransformStream } from 'stream/web';

// @ts-ignore - Required for Node.js environment compatibility
globalThis.TextEncoder = TextEncoder;
// @ts-ignore
globalThis.TextDecoder = TextDecoder;
// @ts-ignore
globalThis.crypto = webcrypto;
// @ts-ignore - Web Streams API polyfills
globalThis.ReadableStream = ReadableStream;
// @ts-ignore
globalThis.WritableStream = WritableStream;
// @ts-ignore
globalThis.TransformStream = TransformStream;

import type { NormalizedResponse, ChatMessage } from '../../languagemodels/BaseLanguageModel';
import { GraphRegistry } from '../../services/GraphRegistry';
import type { SkillGraphState } from '../Graph';

// Mock ONLY ES module dependencies that cause import syntax errors
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn()
}));

// ============================================================================
// MOCK LLM - Intercept at BaseLanguageModel.chat() level
// ============================================================================

/** Log of every LLM call for test assertions */
const llmCallLog: Array<{
  systemPrompt: string;
  userMessages: string[];
  responseKey: string;
}> = [];

/**
 * Build a NormalizedResponse matching the shape BaseLanguageModel.chat() returns.
 * This is what BaseNode.normalizedChat() receives — no HTTP parsing needed.
 */
function buildNormalizedResponse(content: any, options?: Partial<NormalizedResponse['metadata']>): NormalizedResponse {
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  return {
    content: contentStr,
    metadata: {
      tokens_used: 150,
      time_spent: 50,
      prompt_tokens: 100,
      completion_tokens: 50,
      model: 'mock-test-model',
      finish_reason: undefined,
      tool_calls: undefined,
      reasoning: undefined,
      parsed_content: typeof content === 'object' ? content : undefined,
      ...options,
    },
  };
}

/**
 * Mock LLM chat handler - inspects the system prompt to determine which node
 * is calling and returns the appropriate structured response.
 *
 * This replaces the brittle fetch mock that had to match URL patterns and
 * parse raw HTTP request bodies.
 */
async function mockChat(messages: ChatMessage[], options?: any): Promise<NormalizedResponse | null> {
  // Extract system prompt (last system message, same as BaseNode appends it)
  const systemMsg = [...messages].reverse().find(m => m.role === 'system');
  const systemPrompt = systemMsg?.content || '';
  const userMessages = messages.filter(m => m.role === 'user').map(m => m.content);

  console.log(`[MOCK LLM] chat() called - system prompt preview: "${systemPrompt.substring(0, 120)}..."`);
  console.log(`[MOCK LLM] User messages: ${userMessages.length}, options:`, { format: options?.format, temperature: options?.temperature });

  // ----- Plan Retrieval Node -----
  // Matches: "specialized planning and intent analysis system"
  if (systemPrompt.includes('specialized planning') || systemPrompt.includes('intent analysis')) {
    const response = {
      intent: 'workflow_automation',
      goal: 'Create an n8n workflow for AI news monitoring',
      selected_skill_slug: 'sop-n8n-workflow-creation',
      memory_search: [],
    };
    console.log(`[MOCK LLM] -> PlanRetrievalNode response`);
    llmCallLog.push({ systemPrompt, userMessages, responseKey: 'plan_retrieval' });
    return buildNormalizedResponse(response);
  }

  // ----- Planner Node -----
  // Matches: "planning AI" or "actionable plans" or skill-related planning prompts
  if (systemPrompt.includes('planning AI') ||
      systemPrompt.includes('actionable plans') ||
      systemPrompt.includes('SELECTED SOP SKILL') ||
      systemPrompt.includes('SOP execution') ||
      systemPrompt.includes('strategic planning') ||
      systemPrompt.includes('based on user goals')) {
    const response = 'RESPONSE: PLAN\n\nGoal: Create an n8n workflow that monitors social media for AI news and delivers automated reports\n\n1. [ ] Set up n8n instance and verify connectivity\n2. [ ] Configure API credentials for news sources\n3. [ ] Create workflow nodes for data collection\n4. [ ] Implement AI content detection logic\n5. [ ] Set up automated reporting system';
    console.log(`[MOCK LLM] -> PlannerNode response (text plan)`);
    llmCallLog.push({ systemPrompt, userMessages, responseKey: 'planner' });
    return buildNormalizedResponse(response);
  }

  // ----- Reasoning Node -----
  // Matches: "ReAct reasoning agent"
  if (systemPrompt.includes('ReAct reasoning agent')) {
    const response = `STATUS: COMPLETE

## Updated Plan
1. [DONE] Set up n8n instance and verify connectivity
2. [DONE] Configure API credentials for news sources
3. [DONE] Create workflow nodes for data collection
4. [DONE] Implement AI content detection logic
5. [DONE] Set up automated reporting system

All steps completed successfully. The n8n workflow for AI news monitoring is fully configured.`;
    console.log(`[MOCK LLM] -> ReasoningNode response (STATUS: COMPLETE)`);
    llmCallLog.push({ systemPrompt, userMessages, responseKey: 'reasoning' });
    return buildNormalizedResponse(response);
  }

  // ----- Action Node -----
  // Matches: "Execute the next steps from this plan"
  if (systemPrompt.includes('Execute the next steps')) {
    const response = 'Executed plan steps. Set up n8n instance, configured API credentials, and created workflow nodes for AI news monitoring.';
    console.log(`[MOCK LLM] -> ActionNode response`);
    llmCallLog.push({ systemPrompt, userMessages, responseKey: 'action' });
    return buildNormalizedResponse(response);
  }

  // ----- Default / catch-all -----
  console.log(`[MOCK LLM] -> Default response (no prompt match)`);
  console.log(`[MOCK LLM]    Full system prompt:\n${systemPrompt}`);
  llmCallLog.push({ systemPrompt, userMessages, responseKey: 'default' });
  return buildNormalizedResponse('Default mock response for testing');
}

// Create mock BaseLanguageModel instance
const mockLLM = {
  chat: jest.fn(mockChat),
  initialize: jest.fn().mockResolvedValue(true),
  isAvailable: jest.fn().mockReturnValue(true),
  getModel: jest.fn().mockReturnValue('mock-test-model'),
  getBaseUrl: jest.fn().mockReturnValue('http://mock-llm'),
  getProviderName: jest.fn().mockReturnValue('MockLLM'),
  healthCheck: jest.fn().mockResolvedValue(true),
};

// Mock getService to return our mock LLM instead of real Ollama/Remote services.
// NOTE: jest.mock() is hoisted above all variable declarations, so we use
// mockImplementation() with arrow functions for lazy access to mockLLM.
jest.mock('../../languagemodels', () => {
  const actual = jest.requireActual('../../languagemodels');
  return {
    ...actual,
    getService: jest.fn().mockImplementation(async () => mockLLM),
    getLLMService: jest.fn().mockImplementation(async () => mockLLM),
    getLocalService: jest.fn().mockImplementation(async () => mockLLM),
    getRemoteService: jest.fn().mockImplementation(async () => mockLLM),
    getCurrentMode: jest.fn().mockImplementation(async () => 'remote'),
    getCurrentModel: jest.fn().mockImplementation(async () => 'mock-test-model'),
  };
});

// DO NOT MOCK GraphRegistry, nodes, routing logic, or tools - that's what we're testing

describe('SkillGraph Integration - Real Graph Execution', () => {

  beforeEach(() => {
    llmCallLog.length = 0;
    mockLLM.chat.mockClear();
  });

  afterAll(async () => {
    // Clean up all connections to allow Jest to exit
    try {
      console.log('[INTEGRATION TEST] Cleaning up connections...');

      const { getDatabaseManager } = await import('../../database/DatabaseManager');
      await getDatabaseManager().stop();

      console.log('[INTEGRATION TEST] Connections cleaned up');
    } catch (error) {
      console.warn('[INTEGRATION TEST] Cleanup warning:', error);
    }

    // Force Jest to exit after cleanup
    setTimeout(() => {
      process.exit(0);
    }, 100);
  });

  test('CRITICAL: Skill-focused plans must route to reasoning, NOT output', async () => {
    console.log('[INTEGRATION TEST] Starting SkillGraph execution test via GraphRegistry...');

    // Use proper Sulla system initialization (from sulla.ts)
    const { SullaSettingsModel } = await import('../../database/models/SullaSettingsModel');
    const { getDatabaseManager } = await import('../../database/DatabaseManager');

    // Set fallback path like production does
    SullaSettingsModel.setFallbackFilePath('/tmp/test-settings.json');

    // Initialize database manager like production
    const dbManager = getDatabaseManager();
    await dbManager.initialize().catch((err: any) => {
      console.debug('[INTEGRATION TEST] Database initialization:', err.message);
    });

    // Use GraphRegistry to get SkillGraph (same as production with existing settings)
    const { graph, state: initialState } = await GraphRegistry.getOrCreateSkillGraph(
      'integration-test-channel',
      'skill-routing-test-001'
    ) as { graph: any; state: SkillGraphState };

    // Add user message for workflow creation
    initialState.messages.push({
      role: 'user',
      content: 'Create an n8n workflow for AI news monitoring'
    });

    console.log('[INTEGRATION TEST] Executing graph from input_handler...');

    // Execute the actual graph (not mocked)
    const result = await graph.execute(initialState);

    console.log(`[INTEGRATION TEST] Final node reached: ${result.metadata.currentNodeId}`);
    console.log(`[INTEGRATION TEST] Iterations completed: ${result.metadata.iterations}`);

    // Log ALL metadata for debugging the routing issue
    console.log(`[INTEGRATION TEST] Full metadata:`, JSON.stringify(result.metadata, null, 2));

    // Log LLM call history
    console.log(`[INTEGRATION TEST] LLM calls made: ${llmCallLog.length}`);
    llmCallLog.forEach((call, i) => {
      console.log(`[INTEGRATION TEST]   Call ${i + 1}: ${call.responseKey} (prompt: "${call.systemPrompt.substring(0, 80)}...")`);
    });

    // Log plan data for debugging
    const plannerData = (result.metadata as any).planner;
    const planRetrievalData = (result.metadata as any).planRetrieval;

    console.log(`[INTEGRATION TEST] Plan retrieval data:`, planRetrievalData);
    console.log(`[INTEGRATION TEST] Planner data:`, plannerData);

    if (plannerData) {
      console.log(`[INTEGRATION TEST] Plan generated - skill_focused: ${plannerData.skill_focused}, responseImmediate: ${plannerData.responseImmediate}`);
    } else {
      console.log('[INTEGRATION TEST] NO PLAN DATA FOUND - this is the routing bug!');
    }

    // CRITICAL BUG DETECTION: This test successfully identified the production routing bug
    expect(result).toBeDefined();

    // Verify our mock LLM was actually called
    expect(mockLLM.chat).toHaveBeenCalled();
    console.log(`[INTEGRATION TEST] Mock LLM called ${mockLLM.chat.mock.calls.length} time(s)`);

    // Verify routing uses planner's responseImmediate (not planRetrieval's)
    console.log('[INTEGRATION TEST] ROUTING CHECK:');
    console.log(`[INTEGRATION TEST] - PlannerNode returns skill_focused: ${plannerData?.skill_focused}`);
    console.log(`[INTEGRATION TEST] - PlannerNode returns responseImmediate: ${plannerData?.responseImmediate}`);
    console.log(`[INTEGRATION TEST] - Routed to: '${result.metadata.currentNodeId}'`);

    // With the fix, skill-focused plans should now route through the ReAct loop
    expect(plannerData?.skill_focused).toBe(true);
    expect(plannerData?.responseImmediate).toBe(false);
  }, 30000); // 30 second timeout to prevent hanging
});

console.log('SKILLGRAPH INTEGRATION TESTS - Testing actual graph routing with real components');
