# State Metadata Structure for Hierarchical Graph

## Overview
The `ThreadState.metadata` object tracks execution context, decisions, and flow control throughout the hierarchical planning graph.

## Complete Metadata Structure

```typescript
interface ThreadStateMetadata {
  // === Core Execution Control ===
  __emitAgentEvent?: (event: AgentRuntimeEvent) => void;  // WebSocket event emitter
  wsChannel?: string;                                // WebSocket connection identifier
  sameNodeLoopCount?: number;                             // Prevent infinite loops on same node
  maxIterationsReached?: boolean;                         // Safety flag for max iterations
  
  // === Memory & Context ===
  memories?: Array<{                                    // Retrieved memories
    content: string;
    relevance_score?: number;
    metadata?: Record<string, any>;
  }>;
  
  // === Strategic Planning Layer ===
  strategicPlan?: {                                     // High-level plan from StrategicPlannerNode
    goal?: string;
    milestones?: Array<{
      id?: string;
      title?: string;
      description?: string;
      successCriteria?: string;
      orderIndex?: number;
    }>;
  };
  
  activePlanId?: number;                                // Current plan ID from database
  activeMilestone?: {                                   // Currently active milestone
    id?: string;
    title?: string;
    description?: string;
    successCriteria?: string;
    orderIndex?: number;
  };
  
  // === Tactical Planning Layer ===
  tacticalPlan?: {                                      // Micro-plan for current milestone
    steps?: Array<{
      description?: string;
      tools?: string[];
      expectedOutcome?: string;
    }>;
  };
  
  // === Execution Layer ===
  executorContinue?: boolean;                           // TacticalExecutorNode wants more work
  toolResults?: Record<string, any>;                    // Results from tool executions
  currentStep?: number;                                 // Current step index in tactical plan
  
  // === Critic Layer ===
  criticDecision?: 'approve' | 'revise' | 'continue';  // TacticalCriticNode decision
  criticReason?: string;                                // Reason for critic decision
  finalCriticDecision?: 'approve' | 'revise';           // StrategicCriticNode final decision
  
  // === Revision Tracking ===
  revisionCount?: number;                               // Number of revisions attempted
  maxRevisions?: number;                                // Maximum allowed revisions
  
  // === OverLord Layer (Heartbeat Graph) ===
  overlordDecision?: 'plan' | 'wait' | 'end';          // OverLordPlannerNode decision
  heartbeatContext?: {                                  // Heartbeat-triggered context
    idleTime?: number;
    lastActivity?: string;
    priority?: number;
  };
  
  // === Knowledge Layer (if used) ===
  knowledgePlan?: {                                     // Knowledge gathering plan
    queries?: Array<{
      question?: string;
      sources?: string[];
      priority?: number;
    }>;
  };
  
  knowledgeResults?: Array<{                            // Results from knowledge gathering
    query?: string;
    answer?: string;
    sources?: string[];
    confidence?: number;
  }>;
}
```

## Flow Visualization

```
┌─────────────────┐
│   Initial State │
│ metadata: {}     │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  MemoryNode     │
│ memories: []    │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│StrategicPlanner │
│strategicPlan:   │
│ { goal,         │
│   milestones[] }│
│activePlanId: N  │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│TacticalPlanner  │
│tacticalPlan:    │
│ { steps[] }     │
│activeMilestone: │
│ {...}           │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│TacticalExecutor │
│executorContinue │
│toolResults: {}  │
│currentStep: N   │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│TacticalCritic   │
│criticDecision:  │
│ 'approve'|'revise'│
│criticReason: "" │
│revisionCount: N │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│StrategicCritic  │
│finalCriticDecision│
│ 'approve'|'revise'│
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│   Complete      │
└─────────────────┘
```

## Key Metadata Transitions

### 1. Strategic Planning Phase
```typescript
// Before StrategicPlannerNode
metadata: {}

// After StrategicPlannerNode
metadata: {
  strategicPlan: {
    goal: "Build a React dashboard",
    milestones: [
      { title: "Setup project", orderIndex: 1 },
      { title: "Create components", orderIndex: 2 }
    ]
  },
  activePlanId: 123
}
```

### 2. Tactical Planning Phase
```typescript
// After TacticalPlannerNode
metadata: {
  ...strategicPlan,
  activeMilestone: {
    title: "Setup project",
    orderIndex: 1
  },
  tacticalPlan: {
    steps: [
      { description: "Initialize React app", tools: ["npm"] },
      { description: "Install dependencies", tools: ["npm"] }
    ]
  }
}
```

### 3. Execution Phase
```typescript
// During TacticalExecutorNode
metadata: {
  ...previous,
  currentStep: 0,
  executorContinue: true,
  toolResults: {
    "npm_init": { success: true, output: "Package created" }
  }
}
```

### 4. Critic Phase
```typescript
// After TacticalCriticNode
metadata: {
  ...previous,
  criticDecision: "approve",
  criticReason: "Step completed successfully",
  revisionCount: 0
}
```

## Loop Control Logic

### Same Node Loop Prevention
```typescript
// Graph tracks consecutive loops on same node
metadata.sameNodeLoopCount = 3;  // After 3 loops on same node

// After 15 loops, graph forces termination
if (metadata.sameNodeLoopCount >= 15) {
  break; // Force end
}
```

### Revision Control
```typescript
// TacticalCriticNode revision logic
if (metadata.revisionCount >= metadata.maxRevisions) {
  metadata.criticDecision = "approve";  // Auto-approve
  metadata.criticReason = "Max revisions reached";
}
```

## Heartbeat Graph Extensions

When using the heartbeat graph, additional metadata is added:

```typescript
metadata: {
  overlordDecision: "plan",
  heartbeatContext: {
    idleTime: 300000,      // 5 minutes idle
    lastActivity: "user_input",
    priority: "high"
  }
}
```

## Error Handling Metadata

```typescript
metadata: {
  lastError: {
    node: "tactical_executor",
    error: "Tool execution failed",
    timestamp: Date.now(),
    retryCount: 2
  }
}
```

This metadata structure provides a complete execution context that flows through the hierarchical graph, enabling intelligent decision-making, loop prevention, and comprehensive tracking of the planning and execution process.
