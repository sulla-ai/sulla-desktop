# Active Plan Management & Takeover System

## Overview

The Active Plan Management system prevents duplicate work while enabling intelligent plan takeover for stalled processes. It uses a 3-strike system for plan health assessment and provides seamless state inheritance during takeovers.

## Architecture Components

### Storage Layer: SullaSettingsModel
- **Multi-tier fallback**: Redis → PostgreSQL → File
- **Fault tolerance**: System continues operating even if Redis/PG are down
- **Key structure**: `active_plan:${threadId}:${planId}`
- **Data format**: JSON serialized ActivePlan objects

### Core Flow: InputHandler → PlanRetrievalNode → PlannerNode

```
[User Message] 
    ↓
[PlanRetrievalNode] - Selects skill, checks active plans
    ↓  
[PlannerNode] - 3-strike system for plan health assessment
```

## 3-Strike Plan Takeover System

### Strike 1: Plan is Healthy ✅
```typescript
// Same skill selected, existing plan found
const existingPlan = await this.checkForExistingPlan(state, selectedSkill);

if (existingPlan && this.isPlanHealthy(existingPlan)) {
  // STOP FLOW - Return status message
  return this.createStatusMessage(existingPlan);
}
```

**Criteria for Healthy Plan:**
- Last heartbeat < 60 seconds ago
- Status: 'planning' or 'executing'  
- Executor PID exists and responding

**Action:** End flow immediately with status message to user.

### Strike 2: Plan is Unhealthy ⚠️
```typescript
if (existingPlan && this.isPlanUnhealthy(existingPlan)) {
  // PAUSE PLAN - Mark for monitoring
  await activePlanManager.markAsPaused(existingPlan.planId);
  return this.createPauseMessage(existingPlan);
}
```

**Criteria for Unhealthy Plan:**
- Last heartbeat 60-120 seconds ago
- Status: 'executing' but silent
- Executor PID not responding to heartbeat checks

**Action:** Mark plan as 'paused', end flow with monitoring message.

### Strike 3: Plan is Stale 💀
```typescript
if (existingPlan && this.isPlanStale(existingPlan)) {
  // TAKEOVER PLAN - Inherit state and re-plan
  const inheritedState = await this.executeStateTakeover(existingPlan);
  const newPlan = await this.createTakeoverPlan(goal, inheritedState);
  
  // Signal abort to old executor
  await activePlanManager.signalAbortToExecutor(existingPlan.executorPID);
  
  return newPlan;
}
```

**Criteria for Stale Plan:**
- Last heartbeat > 120 seconds ago
- Status: 'paused' or 'executing'
- No response to multiple heartbeat attempts
- Plan marked as `takeoverAllowed: true`

**Action:** Execute full state takeover and create new plan with inherited context.

## State Takeover Process

### 1. State Inheritance
```typescript
interface InheritedPlanState {
  originalPlanId: string;
  originalGoal: string;
  skillContext: any;
  executedSteps: string[];      // What was completed
  partialResults: any;          // Partial API responses, data
  failurePoints: string[];      // Where the original plan failed
  timeElapsed: number;          // How long original plan ran
  lastKnownProgress: string;    // Last status update
}
```

### 2. Takeover Plan Creation
```typescript
const takeoverPlan: PlannerResponse = {
  restated_goal: `Takeover: ${inheritedState.originalGoal}`,
  plan_steps: [
    'Review inherited state from stalled plan',
    `Verify completed steps: ${inheritedState.executedSteps.join(', ')}`,
    'Identify failure points and recovery strategy',
    'Resume execution from last known good state',
    'Complete remaining objectives with fresh executor'
  ],
  complexity_score: inheritedState.complexity_score + 1,
  complexity_reasoning: 'Increased complexity due to state takeover and recovery',
  skill_focused: true,
  estimated_duration: '2-3 minutes',
  inheritedState: inheritedState,
  takeoverMetadata: {
    originalExecutor: existingPlan.executorPID,
    takeoverTimestamp: Date.now(),
    takeoverReason: 'stalled_plan_recovery'
  }
};
```

## Executor Displacement & Abort Signals

### Abort Signal Flow
```typescript
// When takeover occurs
await activePlanManager.signalAbortToExecutor(existingPlan.executorPID);

// Old executor's next heartbeat
const { shouldAbort } = await activePlanManager.sendHeartbeat(
  threadId, planId, oldExecutorPID
);

if (shouldAbort) {
  // Save progress and terminate
  await this.saveProgressToMessages(currentProgress);
  throw new AbortError('Plan ownership transferred');
}
```

### Old Executor Responsibilities
When receiving abort signal, the displaced executor must:

1. **Save Current Progress**
   ```typescript
   const progressMessage = {
     role: 'assistant',
     content: 'Plan execution interrupted - saving progress...',
     metadata: {
       executorPID: this.executorPID,
       partialResults: this.gatheredData,
       lastStep: this.currentStep,
       failureReason: 'takeover_displacement'
     }
   };
   ```

2. **Clean Up Resources**
   - Close API connections
   - Cancel pending operations
   - Release memory/file handles

3. **Terminate Gracefully**
   - No throwing errors
   - No retries or recovery attempts
   - Log displacement event

## Implementation Timeline

### Phase 1: Storage Enhancement
- [ ] Extend SullaSettingsModel with pattern-based querying
- [ ] Add `getByPattern(pattern)` and `deleteByPattern(pattern)` methods
- [ ] Implement active plan serialization/deserialization

### Phase 2: Plan Health Assessment
- [ ] Implement `isPlanHealthy()`, `isPlanUnhealthy()`, `isPlanStale()` methods
- [ ] Add heartbeat validation and timeout logic
- [ ] Create plan status message generators

### Phase 3: State Takeover
- [ ] Design inherited state structure
- [ ] Implement state extraction from stalled plans
- [ ] Create takeover plan generation logic

### Phase 4: Abort Mechanism  
- [ ] Implement executor displacement signals
- [ ] Add progress saving for interrupted plans
- [ ] Test graceful termination flows

## Error Handling & Edge Cases

### Storage Failures
- Redis down: Fall back to PostgreSQL
- PostgreSQL down: Fall back to file storage
- File system issues: Log error, continue with in-memory state

### Concurrent Takeovers
- Use atomic operations for plan ownership transfer
- Implement optimistic locking with version numbers
- Handle race conditions gracefully

### Network Partitions
- Implement circuit breaker patterns
- Add retry logic with exponential backoff
- Fail fast for critical operations

### Invalid State Data
- Validate inherited state structure
- Provide default values for missing fields  
- Log corruption incidents for debugging

## Monitoring & Observability

### Key Metrics
- Plan takeover frequency
- Executor displacement rate  
- State inheritance success rate
- Average recovery time after takeover

### Logging
```typescript
console.log(`[PlanManager] Healthy plan found - stopping flow`);
console.log(`[PlanManager] Unhealthy plan detected - marking as paused`);
console.log(`[PlanManager] Stale plan takeover initiated`);
console.log(`[PlanManager] State inherited: ${Object.keys(inheritedState)}`);
```

This system provides robust plan management with intelligent failure recovery while maintaining the streaming conversation flow for 11Labs integration.
