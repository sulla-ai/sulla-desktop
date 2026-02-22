# Debugging Production Tests: A Systematic Approach

## Overview

This guide documents a reusable approach for setting up and debugging production-like tests. It focuses on environment correctness, reproducibility, and catching real compatibility issues without shortcuts.

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

## Common Environment Issues and Solutions

### Issue 1: Missing Runtime Globals in Node Test Environment

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

### Issue 2: Settings/Config Bootstrap Not Initialized

**Problem examples:**
- Fallback path not set
- Missing installation lock file
- Runtime config values not found during tests

**Root Cause:** Test setup did not initialize settings/config in the same order production does.

**Solution pattern:**
```typescript
// In beforeAll:
// 1) configure fallback path
// 2) initialize settings/config
// 3) initialize database/services
```

### Issue 3: Resource Cleanup Missing (Tests Hang)

**Problem:** Jest process hangs or does not exit.

**Root Cause:** Open handles from DB pools, sockets, streams, background timers.

**Solution:**
```bash
jest --runInBand --detectOpenHandles --forceExit
```

and add explicit cleanup in `afterAll` for DB/service resources.

### Issue 4: Environment Auth/Signature Mismatch

**Problem:** API returns auth/signature errors in tests (401/403).

**Root Cause:** Service account/API key/config in test runtime differs from live service expectations.

**Solution pattern:**
- Ensure the same account/key derivation path as production.
- Validate required settings are loaded before service initialization.
- Fail fast with explicit setup checks before running assertions.

## Validation Checklist

Before considering a test "fixed":

- [ ] All TypeScript errors resolved (no `--no-check` shortcuts)
- [ ] All runtime errors resolved (no try-catch hiding)
- [ ] Real production workflow tested (no simplified test paths)
- [ ] State transformations validated (metadata populated correctly)
- [ ] Evidence collection working (proper fact-checking)
- [ ] All 3 test scenarios pass (main workflow + edge cases)

## Environment Setup Checklist (Most Tests)

Use this checklist before debugging logic failures:

1. **Runtime globals/polyfills** are in place (`TextEncoder`, streams, crypto, fetch if needed).
2. **Settings/config fallback path** is configured for the test process.
3. **Settings/config store is initialized** before dependent services.
4. **Database client is initialized** and reachable.
5. **Service account/auth material** is loaded and valid for target API.
6. **External dependencies** are either reachable or intentionally mocked.
7. **Cleanup hooks** close DB/network resources in `afterAll`.
8. Test command uses `--runInBand --detectOpenHandles --forceExit` for debugging hangs.

## Key Takeaways

1. **Initialize environment first** (settings → DB → services) before testing behavior.
2. **Use real production paths** and avoid mocking core internal logic.
3. **Treat failures as signals** of real compatibility problems.
4. **Use debugging flags + cleanup** to prevent hanging test runs.
5. **Keep setup deterministic** so failures are reproducible.
