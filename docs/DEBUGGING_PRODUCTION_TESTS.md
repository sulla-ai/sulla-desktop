# Debugging Production Tests: A Systematic Approach

## Overview

This guide documents the systematic debugging approach developed while fixing the SkillGraph production tests. It provides a proven methodology for identifying and resolving real production compatibility issues without taking shortcuts.

## Core Principles

### 1. **No Shortcuts Philosophy**
- Production tests should catch **real production issues**
- Fix the actual compatibility problems, don't bypass them
- If a test fails, it's revealing a legitimate issue that needs fixing
- Shortcuts hide problems that will surface in production

### 2. **Real Production Workflows**
- Use actual production APIs (e.g., `GraphRegistry.getOrCreateSkillGraph()`)
- Test the exact user path, not simplified test-only paths
- Mock only external services, use real internal implementations
- Validate actual state transformations and TypeScript compatibility

## Systematic Debugging Process

### Step 1: Add Debug Logging
When tests fail mysteriously, add comprehensive debug logging to understand what's actually happening:

```typescript
// Add debug logging to LLM mocks
console.log('🔍 [LLM MOCK DEBUG] Received prompt:', prompt.substring(0, 100) + '...');
console.log('🔍 [LLM MOCK DEBUG] Messages array length:', messages.length);

// Log response structure
console.log('🔍 [LLM MOCK DEBUG] Response structure:', {
  hasContent: !!response.content,
  contentType: typeof response.content,
  contentLength: response.content?.length,
  contentPreview: response.content?.substring(0, 50),
  hasMetadata: !!response.metadata
});

// Log full response for inspection
console.log('🔍 [LLM MOCK DEBUG] FULL RESPONSE:', JSON.stringify(response, null, 2));
```

### Step 2: Use Throw Statements for Inspection
Add throw statements to capture and inspect exact values:

```typescript
// Throw to debug exact response structure
throw new Error(`DEBUG: Response structure is: ${JSON.stringify(response, null, 2)}`);
```

### Step 3: Compare Expected vs Actual Formats
Look at what the real nodes expect vs what your mocks provide:

```typescript
// Real node expectation (from BaseNode.chat)
if (options.format === 'json') {
  const parsedReply = this.parseJson(reply.content); // Expects reply.content to be JSON string
}

// Your mock must match this structure
return {
  content: JSON.stringify(actualJsonObject), // JSON string in content field
  metadata: { tokens_used: 150, ... }
};
```

## Common Issues and Solutions

### Issue 1: LLM Mock Response Format Mismatch

**Problem:** `[Plan Retrieval] Parsed JSON in method:chat: null`

**Root Cause:** BaseNode expects different response formats for different options:
- `format: 'json'` → expects `reply.content` to contain JSON string
- No format option → expects string response directly

**Solution:**
```typescript
// For nodes using format: 'json'
if (prompt.includes('Plan Retrieval')) {
  return {
    content: JSON.stringify({
      intent: 'development',
      goal: 'Create Node.js project with best practices',
      selected_skill_slug: null,
      memory_search: [],
      response_immediate: false
    }),
    metadata: { tokens_used: 150, ... }
  };
}

// For nodes with no format option
if (prompt.includes('Strategic Planning')) {
  return 'Direct string response here';
}
```

### Issue 2: Missing Mock Methods

**Problem:** `TypeError: tools_1.toolRegistry.getCategoriesWithDescriptions is not a function`

**Root Cause:** Incomplete mock definitions missing methods used by real nodes.

**Solution:**
```typescript
jest.mock('../../tools', () => ({
  toolRegistry: {
    getCategoriesWithDescriptions: jest.fn(() => [
      { category: 'file_operations', description: 'File operations' }
    ]),
    getToolsInCategory: jest.fn(() => []),
    getToolsByCategory: jest.fn(() => []),
    getLLMToolsFor: jest.fn(() => []),
    getAllTools: jest.fn(() => [])
  }
}));
```

### Issue 3: Environment Compatibility Issues

**Problem:** `ReferenceError: TextEncoder is not defined`

**Root Cause:** Node.js environment missing browser globals required by dependencies.

**Solution:**
```typescript
// Add Node.js polyfills for production compatibility
import { TextEncoder, TextDecoder } from 'util';
import { webcrypto } from 'crypto';
import { ReadableStream, WritableStream, TransformStream } from 'stream/web';

globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;
globalThis.crypto = webcrypto;
globalThis.ReadableStream = ReadableStream;
globalThis.WritableStream = WritableStream;
globalThis.TransformStream = TransformStream;
```

### Issue 4: TypeScript Type Compatibility

**Problem:** GraphRegistry returns `BaseThreadState` but SkillGraph needs `SkillGraphState`

**Root Cause:** Missing type definitions for specialized state requirements.

**Solution:** Define proper types and use type assertions where necessary:
```typescript
// Define specialized state type
export interface SkillGraphState extends BaseThreadState {
  metadata: BaseThreadState['metadata'] & {
    planRetrieval?: { intent: string; goal: string; };
    planner?: { plan_steps: string[]; skill_focused: boolean; };
    // ... other SkillGraph-specific metadata
  };
}

// Use type assertion when needed
const finalState = await graph.execute(initialState) as SkillGraphState;
```

## Mock Structure Patterns

### Pattern 1: JSON Response Nodes (format: 'json')
```typescript
if (prompt.includes('Node Name')) {
  const response = {
    property1: 'value1',
    property2: ['array', 'values'],
    property3: { nested: 'object' }
  };
  
  return {
    content: JSON.stringify(response),
    metadata: {
      tokens_used: 150,
      prompt_tokens: 80,
      completion_tokens: 70,
      time_spent: 1200
    }
  };
}
```

### Pattern 2: String Response Nodes (no format option)
```typescript
if (prompt.includes('Node Name')) {
  return 'Direct string response content';
}
```

### Pattern 3: Tool Registry Mock
```typescript
jest.mock('../../tools', () => ({
  toolRegistry: {
    // Add ALL methods used by any node
    getCategoriesWithDescriptions: jest.fn(() => []),
    getToolsInCategory: jest.fn(() => []),
    getToolsByCategory: jest.fn(() => []),
    getLLMToolsFor: jest.fn(() => []),
    getAllTools: jest.fn(() => [])
  }
}));
```

## Validation Checklist

Before considering a test "fixed":

- [ ] All TypeScript errors resolved (no `--no-check` shortcuts)
- [ ] All runtime errors resolved (no try-catch hiding)
- [ ] Real production workflow tested (no simplified test paths)
- [ ] State transformations validated (metadata populated correctly)
- [ ] Evidence collection working (proper fact-checking)
- [ ] All 3 test scenarios pass (main workflow + edge cases)

## Production Issues Found and Fixed

During SkillGraph debugging, we identified and fixed **10+ real production issues**:

1. Missing SkillGraph TypeScript state types
2. BaseThreadState missing required properties
3. Wrong LLM service mock path
4. Missing Node.js TextEncoder polyfills
5. Missing ReadableStream/web streams polyfills
6. LLM mock missing metadata structure
7. GraphRegistry type mismatch with SkillGraphState
8. SullaSettingsModel fallback path not configured
9. LLM response format mismatch
10. Missing toolRegistry methods

Each of these would have caused production failures if not caught and fixed.

## Key Takeaways

1. **Debug systematically** - Add logging, inspect values, understand the flow
2. **Fix real issues** - Don't shortcut around problems
3. **Test production paths** - Use real APIs and workflows
4. **Validate thoroughly** - Check state transformations and TypeScript compatibility
5. **Document patterns** - Create reusable mock structures for common scenarios

This approach ensures tests catch real production issues and prevent deployment failures.

## Case Study: SkillGraph Routing Bug Discovery

### Background
While developing integration tests for SkillGraph routing behavior, we discovered a **critical production bug** where skill-focused plans were incorrectly routing to `output` instead of `reasoning`, bypassing the ReAct loop entirely.

### The Bug
**Expected Behavior:**
1. User requests workflow creation → `plan_retrieval` selects skill → `planner` creates skill-focused plan → routes to `reasoning` for execution

**Actual Behavior:**
1. User requests workflow creation → `plan_retrieval` selects skill → `planner` creates **generic fallback plan** → routes to `output` (skips execution)

### Root Cause Analysis

**Step 1: Test Infrastructure Issues**
- **Jest Hanging:** Tests hung indefinitely due to unclosed database connections
  - **Solution:** Added proper cleanup with `getDatabaseManager().stop()` and `--forceExit`
- **Network Mocking:** Initially tried mocking `fetch()` but LLM services use different HTTP clients
  - **Solution:** Mock at `languagemodels` level instead of network level

**Step 2: LLM Mock Configuration**
- **Pattern Recognition Failed:** Mock conditions weren't matching actual system messages
- **Debug Strategy:** Added logging to capture actual system message content
- **Solution:** Fixed mock conditions to match real prompts

**Step 3: The Actual Bug Discovery**
Through comprehensive debugging, we found:

```typescript
// Plan Retrieval (WORKING CORRECTLY)
planRetrieval: {
  selected_skill_slug: "sop-n8n-workflow-creation", // ✅ Skill detected
  response_immediate: false                         // ✅ Should route to reasoning
}

// Planner Node (THE BUG)
planner: {
  skill_focused: false,  // ❌ WRONG! Should be true
  plan_steps: [          // ❌ Generic fallback plan, not skill-specific
    "Analyze the requirements and context",
    "Break down the task into manageable components",
    // ... generic steps
  ]
}
```

**The bug:** Even when PlanRetrievalNode correctly identifies a skill, PlannerNode falls back to generic planning instead of using the skill-specific SOP, causing `skill_focused: false` and routing to output.

### Testing Strategy Learnings

**1. Integration Test Architecture**
```typescript
// ✅ CORRECT: Use actual GraphRegistry
const { graph, state } = await GraphRegistry.getOrCreateSkillGraph(channel, threadId);

// ❌ WRONG: Manual graph creation
const graph = createHierarchicalGraph(); // Bypasses production setup
```

**2. Proper System Initialization**
```typescript
// Follow sulla.ts initialization patterns
const { getDatabaseManager } = await import('../../database/DatabaseManager');
await dbManager.initialize();
SullaSettingsModel.setFallbackFilePath('/tmp/test-settings.json');
```

**3. Strategic Mocking**
- **Mock:** External services (HTTP calls, ES modules causing syntax errors)
- **Don't Mock:** Internal routing logic, GraphRegistry, node execution, tools

**4. Debug Logging Strategy**
```typescript
// Log all metadata to understand routing decisions
console.log(`[DEBUG] Full metadata:`, JSON.stringify(result.metadata, null, 2));

// Log conditional edge inputs
console.log(`[DEBUG] responseImmediate: ${responseImmediate}, hasPlan: ${hasPlan}`);
```

### Production Impact

This test **successfully caught a critical production bug** that would have caused:
- Users requesting workflow automation getting generic responses instead of skill-specific execution
- Complete bypass of the ReAct reasoning loop
- No automated tool usage for complex tasks
- Poor user experience with generic instead of expert-level assistance

### Key Takeaways

1. **Integration tests catch routing bugs** that unit tests miss
2. **Real system initialization** is crucial for finding production issues  
3. **Comprehensive debug logging** reveals the exact failure points
4. **Strategic mocking** (externals only) preserves bug-catching capability
5. **Jest cleanup** requires proper connection management and `--forceExit`

### Next Steps

1. **Fix the PlannerNode bug** - ensure skill-focused plans set `skill_focused: true`
2. **Verify conditional routing** - check Graph.ts routing logic for skill-focused plans
3. **Add production monitoring** - alert when plans route to output instead of reasoning unexpectedly

This case study demonstrates how properly designed integration tests can catch critical production routing bugs that would otherwise escape to production.
