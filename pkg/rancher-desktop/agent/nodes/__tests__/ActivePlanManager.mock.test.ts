/**
 * Mock Tests for Active Plan Management System
 * Tests the 3-strike takeover system, dynamic heartbeats, and state inheritance
 */

import { ActivePlanManager } from '../ActivePlanManager';

// Mock SullaSettingsModel to avoid real database calls
const mockStorage: Record<string, any> = {};

jest.mock('../../database/models/SullaSettingsModel', () => ({
  SullaSettingsModel: {
    set: jest.fn(async (key: string, value: any) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    get: jest.fn(async (key: string, defaultValue = null) => {
      return Promise.resolve(mockStorage[key] || defaultValue);
    }),
    getByPattern: jest.fn(async (pattern: string) => {
      const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
      const matches: Record<string, any> = {};
      for (const [key, value] of Object.entries(mockStorage)) {
        if (regex.test(key)) {
          matches[key] = value;
        }
      }
      return Promise.resolve(matches);
    }),
    delete: jest.fn(async (key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    })
  }
}));

describe('ActivePlanManager Mock Tests', () => {
  let activePlanManager: ActivePlanManager;
  const mockThreadId = 'thread_test_123';

  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    activePlanManager = ActivePlanManager.getInstance();
  });

  // ============================================================================
  // TEST 1: BASIC PLAN REGISTRATION AND RETRIEVAL
  // ============================================================================
  
  describe('Basic Plan Management', () => {
    test('should register and retrieve active plans', async () => {
      const executorPID = await activePlanManager.registerActivePlan(
        mockThreadId,
        'plan_001',
        'Pull customer order information',
        'order-lookup',
        'Order Lookup'
      );

      expect(executorPID).toMatch(/^pid_\d+_[a-z0-9]+$/);

      const activePlans = await activePlanManager.getActivePlans(mockThreadId);
      expect(activePlans).toHaveLength(1);
      expect(activePlans[0].planId).toBe('plan_001');
      expect(activePlans[0].goal).toBe('Pull customer order information');
      expect(activePlans[0].skillSlug).toBe('order-lookup');
      expect(activePlans[0].executorPID).toBe(executorPID);
    });

    test('should handle multiple parallel plans for different skills', async () => {
      // Register multiple different plans
      await activePlanManager.registerActivePlan(
        mockThreadId, 'plan_order', 'Get order info', 'order-lookup', 'Order Lookup'
      );
      await activePlanManager.registerActivePlan(
        mockThreadId, 'plan_shipping', 'Track shipping', 'shipping-tracker', 'Shipping Tracker'
      );

      const activePlans = await activePlanManager.getActivePlans(mockThreadId);
      expect(activePlans).toHaveLength(2);
      
      const skillSlugs = activePlans.map(p => p.skillSlug);
      expect(skillSlugs).toContain('order-lookup');
      expect(skillSlugs).toContain('shipping-tracker');
    });
  });

  // ============================================================================
  // TEST 2: DYNAMIC HEARTBEAT SYSTEM
  // ============================================================================

  describe('Dynamic Heartbeat System', () => {
    test('should handle custom heartbeat intervals with bounds checking', async () => {
      const executorPID = await activePlanManager.registerActivePlan(
        mockThreadId, 'plan_api', 'Long API call', 'api-integration', 'API Integration'
      );

      // Test custom 2-minute interval
      const result1 = await activePlanManager.sendHeartbeat(
        mockThreadId, 'plan_api', executorPID, 120000 // 2 minutes
      );

      expect(result1.success).toBe(true);
      expect(result1.stillResponsible).toBe(true);
      expect(result1.nextHeartbeatDue).toBeGreaterThan(Date.now() + 110000); // ~2 minutes

      // Test bounds checking - too long interval should be clamped
      const result2 = await activePlanManager.sendHeartbeat(
        mockThreadId, 'plan_api', executorPID, 300000 // 5 minutes - should be clamped to 3 minutes
      );

      expect(result2.success).toBe(true);
      const maxInterval = Date.now() + 180000; // 3 minutes max
      expect(result2.nextHeartbeatDue).toBeLessThanOrEqual(maxInterval + 1000);
    });

    test('should reject heartbeats from displaced executors', async () => {
      const originalPID = await activePlanManager.registerActivePlan(
        mockThreadId, 'plan_test', 'Test plan', 'test-skill', 'Test Skill'
      );

      // Fake takeover by creating new executor
      const newPID = `pid_${Date.now()}_new123`;

      // Manually update the plan with new executor (simulating takeover)
      const planKey = `active_plan:${mockThreadId}:plan_test`;
      const plan = mockStorage[planKey];
      plan.executorPID = newPID;
      mockStorage[planKey] = plan;

      // Original executor tries to heartbeat
      const result = await activePlanManager.sendHeartbeat(
        mockThreadId, 'plan_test', originalPID
      );

      expect(result.success).toBe(false);
      expect(result.stillResponsible).toBe(false);
      expect(result.shouldAbort).toBe(true);
    });
  });

  // ============================================================================
  // TEST 3: PLAN TAKEOVER MECHANISM
  // ============================================================================

  describe('Plan Takeover System', () => {
    test('should execute successful plan takeover for stalled plans', async () => {
      const originalPID = await activePlanManager.registerActivePlan(
        mockThreadId, 'plan_stalled', 'Stalled operation', 'data-export', 'Data Export'
      );

      // Simulate stalled plan by setting old heartbeat
      const planKey = `active_plan:${mockThreadId}:plan_stalled`;
      const plan = mockStorage[planKey];
      plan.lastHeartbeat = Date.now() - 150000; // 2.5 minutes ago
      plan.takeoverAllowed = true;
      mockStorage[planKey] = plan;

      // Attempt takeover
      const takeover = await activePlanManager.attemptPlanTakeover(
        mockThreadId, 'plan_stalled'
      );

      expect(takeover.success).toBe(true);
      expect(takeover.newExecutorPID).toMatch(/^pid_\d+_[a-z0-9]+$/);
      expect(takeover.previousExecutor).toBe(originalPID);

      // Verify plan was updated
      const updatedPlan = mockStorage[planKey];
      expect(updatedPlan.executorPID).toBe(takeover.newExecutorPID);
      expect(updatedPlan.status).toBe('executing');
      expect(updatedPlan.takeoverAllowed).toBe(false);
    });

    test('should prevent takeover of healthy plans', async () => {
      await activePlanManager.registerActivePlan(
        mockThreadId, 'plan_healthy', 'Active plan', 'user-management', 'User Management'
      );

      // Plan has recent heartbeat - should not allow takeover
      const takeover = await activePlanManager.attemptPlanTakeover(
        mockThreadId, 'plan_healthy'
      );

      expect(takeover.success).toBe(false);
      expect(takeover.newExecutorPID).toBe(null);
    });
  });

  // ============================================================================
  // TEST 4: STALLED PLAN DETECTION
  // ============================================================================

  describe('Stalled Plan Detection', () => {
    test('should correctly identify paused and takeover-available plans', async () => {
      // Create plans with different staleness levels
      const recentPID = await activePlanManager.registerActivePlan(
        mockThreadId, 'plan_recent', 'Recent plan', 'skill-1', 'Skill 1'
      );
      
      const pausedPID = await activePlanManager.registerActivePlan(
        mockThreadId, 'plan_paused', 'Should be paused', 'skill-2', 'Skill 2'
      );
      
      const stalePID = await activePlanManager.registerActivePlan(
        mockThreadId, 'plan_stale', 'Should be takeover', 'skill-3', 'Skill 3'
      );

      // Manipulate heartbeat times
      const now = Date.now();
      
      // Recent plan - healthy
      mockStorage[`active_plan:${mockThreadId}:plan_recent`].lastHeartbeat = now - 30000; // 30s ago
      
      // Paused plan - 90s ago
      const pausedPlan = mockStorage[`active_plan:${mockThreadId}:plan_paused`];
      pausedPlan.lastHeartbeat = now - 90000;
      pausedPlan.status = 'executing';
      
      // Stale plan - 150s ago
      const stalePlan = mockStorage[`active_plan:${mockThreadId}:plan_stale`];
      stalePlan.lastHeartbeat = now - 150000;
      stalePlan.status = 'executing';

      const result = await activePlanManager.checkForStalledPlans(mockThreadId);

      expect(result.pausedPlans).toContain('plan_paused');
      expect(result.takeoverAvailable).toContain('plan_stale');
      expect(result.pausedPlans).not.toContain('plan_recent');
      expect(result.takeoverAvailable).not.toContain('plan_recent');
    });
  });

  // ============================================================================
  // TEST 5: EDGE CASES AND ERROR HANDLING
  // ============================================================================

  describe('Edge Cases and Error Handling', () => {
    test('should handle non-existent plans gracefully', async () => {
      const result = await activePlanManager.sendHeartbeat(
        mockThreadId, 'nonexistent_plan', 'fake_pid'
      );

      expect(result.success).toBe(false);
      expect(result.shouldAbort).toBe(true);
      expect(result.nextHeartbeatDue).toBe(0);
    });

    test('should handle empty thread gracefully', async () => {
      const plans = await activePlanManager.getActivePlans('empty_thread');
      expect(plans).toHaveLength(0);

      const skills = await activePlanManager.getActiveSkills('empty_thread');
      expect(skills.skillSlugs).toHaveLength(0);
      expect(skills.skillTitles).toHaveLength(0);
      expect(skills.planSummaries).toHaveLength(0);
    });

    test('should handle plan removal correctly', async () => {
      const executorPID = await activePlanManager.registerActivePlan(
        mockThreadId, 'plan_remove', 'To be removed', 'test-skill', 'Test Skill'
      );

      let plans = await activePlanManager.getActivePlans(mockThreadId);
      expect(plans).toHaveLength(1);

      await activePlanManager.removeActivePlan(mockThreadId, 'plan_remove');

      plans = await activePlanManager.getActivePlans(mockThreadId);
      expect(plans).toHaveLength(0);
    });

    test('should handle status updates with authorization', async () => {
      const executorPID = await activePlanManager.registerActivePlan(
        mockThreadId, 'plan_status', 'Status test', 'status-skill', 'Status Skill'
      );

      // Authorized update should succeed
      const result1 = await activePlanManager.updatePlanStatus(
        mockThreadId, 'plan_status', executorPID, 'executing'
      );
      expect(result1).toBe(true);

      // Unauthorized update should fail
      const result2 = await activePlanManager.updatePlanStatus(
        mockThreadId, 'plan_status', 'fake_pid', 'completed'
      );
      expect(result2).toBe(false);
    });
  });

  // ============================================================================
  // TEST 6: CONCURRENT PLAN SCENARIOS
  // ============================================================================

  describe('Concurrent Plan Management', () => {
    test('should handle multiple plans with same skill correctly', async () => {
      // This tests the scenario where PlanRetrievalNode allows same skill selection
      const pid1 = await activePlanManager.registerActivePlan(
        mockThreadId, 'plan_order_1', 'First order lookup', 'order-lookup', 'Order Lookup'
      );
      
      const pid2 = await activePlanManager.registerActivePlan(
        mockThreadId, 'plan_order_2', 'Second order lookup', 'order-lookup', 'Order Lookup'
      );

      const skills = await activePlanManager.getActiveSkills(mockThreadId);
      expect(skills.skillSlugs.filter(s => s === 'order-lookup')).toHaveLength(2);
      expect(skills.planSummaries).toHaveLength(2);
    });

    test('should generate correct active plan summary', async () => {
      await activePlanManager.registerActivePlan(
        mockThreadId, 'plan_summary_1', 'Test plan 1', 'skill-1', 'Skill One'
      );
      await activePlanManager.registerActivePlan(
        mockThreadId, 'plan_summary_2', 'Test plan 2', 'skill-2', 'Skill Two'
      );

      const summary = await activePlanManager.getActivePlanSummary(mockThreadId);
      
      expect(summary).toContain('Currently Active Plans (2)');
      expect(summary).toContain('Test plan 1');
      expect(summary).toContain('Test plan 2');
      expect(summary).toContain('using Skill One');
      expect(summary).toContain('using Skill Two');
    });
  });
});

// ============================================================================
// MOCK INTEGRATION TESTS WITH PLANNERNNODE
// ============================================================================

describe('PlannerNode Integration Mock Tests', () => {
  // Mock the PlannerNode behavior
  class MockPlannerNode {
    private activePlanManager = ActivePlanManager.getInstance();

    // Mock the 3-strike system
    isPlanHealthy(plan: any): boolean {
      const timeSinceHeartbeat = Date.now() - plan.lastHeartbeat;
      return (
        timeSinceHeartbeat < 60000 &&
        (plan.status === 'planning' || plan.status === 'executing') &&
        plan.executorPID &&
        !plan.takeoverAllowed
      );
    }

    isPlanUnhealthy(plan: any): boolean {
      const timeSinceHeartbeat = Date.now() - plan.lastHeartbeat;
      return (
        timeSinceHeartbeat >= 60000 &&
        timeSinceHeartbeat < 120000 &&
        plan.status === 'executing' &&
        !plan.takeoverAllowed
      );
    }

    isPlanStale(plan: any): boolean {
      const timeSinceHeartbeat = Date.now() - plan.lastHeartbeat;
      return (
        timeSinceHeartbeat >= 120000 ||
        plan.status === 'paused' ||
        plan.takeoverAllowed === true
      );
    }

    async checkExistingPlan(threadId: string, skillSlug: string) {
      const plans = await this.activePlanManager.getActivePlans(threadId);
      return plans.find(p => p.skillSlug === skillSlug);
    }
  }

  let mockPlanner: MockPlannerNode;
  const testThreadId = 'thread_integration_test';

  beforeEach(() => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    mockPlanner = new MockPlannerNode();
  });

  test('Strike 1: Healthy plan should be detected correctly', async () => {
    const activePlanManager = ActivePlanManager.getInstance();
    
    await activePlanManager.registerActivePlan(
      testThreadId, 'plan_healthy', 'Active order lookup', 'order-lookup', 'Order Lookup'
    );

    const existingPlan = await mockPlanner.checkExistingPlan(testThreadId, 'order-lookup');
    expect(existingPlan).toBeTruthy();
    expect(mockPlanner.isPlanHealthy(existingPlan!)).toBe(true);
    expect(mockPlanner.isPlanUnhealthy(existingPlan!)).toBe(false);
    expect(mockPlanner.isPlanStale(existingPlan!)).toBe(false);
  });

  test('Strike 2: Unhealthy plan should be detected correctly', async () => {
    const activePlanManager = ActivePlanManager.getInstance();
    
    await activePlanManager.registerActivePlan(
      testThreadId, 'plan_unhealthy', 'Stalling order lookup', 'order-lookup', 'Order Lookup'
    );

    // Simulate 90 second old heartbeat
    const planKey = `active_plan:${testThreadId}:plan_unhealthy`;
    const plan = mockStorage[planKey];
    plan.lastHeartbeat = Date.now() - 90000;
    plan.status = 'executing';
    mockStorage[planKey] = plan;

    const existingPlan = await mockPlanner.checkExistingPlan(testThreadId, 'order-lookup');
    expect(mockPlanner.isPlanHealthy(existingPlan!)).toBe(false);
    expect(mockPlanner.isPlanUnhealthy(existingPlan!)).toBe(true);
    expect(mockPlanner.isPlanStale(existingPlan!)).toBe(false);
  });

  test('Strike 3: Stale plan should be detected correctly', async () => {
    const activePlanManager = ActivePlanManager.getInstance();
    
    await activePlanManager.registerActivePlan(
      testThreadId, 'plan_stale', 'Dead order lookup', 'order-lookup', 'Order Lookup'
    );

    // Simulate 150 second old heartbeat
    const planKey = `active_plan:${testThreadId}:plan_stale`;
    const plan = mockStorage[planKey];
    plan.lastHeartbeat = Date.now() - 150000;
    plan.status = 'executing';
    mockStorage[planKey] = plan;

    const existingPlan = await mockPlanner.checkExistingPlan(testThreadId, 'order-lookup');
    expect(mockPlanner.isPlanHealthy(existingPlan!)).toBe(false);
    expect(mockPlanner.isPlanUnhealthy(existingPlan!)).toBe(false);
    expect(mockPlanner.isPlanStale(existingPlan!)).toBe(true);
  });
});

console.log('='.repeat(80));
console.log('🧪 ACTIVE PLAN MANAGEMENT MOCK TESTS COMPLETE');
console.log('='.repeat(80));
