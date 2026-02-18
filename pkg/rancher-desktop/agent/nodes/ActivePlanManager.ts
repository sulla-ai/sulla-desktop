import { SullaSettingsModel } from '../database/models/SullaSettingsModel';

// Types for active plan management
interface ActivePlan {
  planId: string;
  threadId: string;
  goal: string;
  skillSlug: string | null;
  skillTitle: string | null;
  startedAt: number;
  lastHeartbeat: number;
  instanceId: string;
  executorPID: string;
  status: 'planning' | 'executing' | 'paused' | 'completed' | 'failed' | 'abandoned';
  heartbeatCount: number;
  takeoverAllowed: boolean;
  nextHeartbeatDue: number; // When next heartbeat is expected (timestamp)
  currentHeartbeatInterval: number; // Current interval in milliseconds
}

interface ActivePlanSummary {
  planId: string;
  goal: string;
  skillTitle: string | null;
  startedAt: number;
  duration: number;
}

/**
 * Active Plan Manager
 * 
 * Manages currently running plans across serverless instances to prevent duplicates:
 * - Tracks active plans in Redis (persistent across instances)
 * - Prevents duplicate skill-based plans
 * - Allows multiple different plans to run simultaneously
 * - Provides filtered skill lists excluding active skills
 * 
 * Key Features:
 * - Thread-level plan tracking (not global)
 * - Automatic plan cleanup on completion
 * - TTL-based cleanup for abandoned plans (30min timeout)
 * - Skill filtering to prevent duplicates
 */
export class ActivePlanManager {
  private static instance: ActivePlanManager | null = null;
  
  // Phone conversation timeouts - much shorter than serverless defaults
  private readonly PLAN_TTL = 300; // 5 minutes maximum plan duration
  private readonly DEFAULT_HEARTBEAT_INTERVAL = 30000; // 30 seconds default interval
  private readonly MIN_HEARTBEAT_INTERVAL = 15000; // 15 seconds minimum
  private readonly MAX_HEARTBEAT_INTERVAL = 180000; // 3 minutes maximum
  private readonly PAUSE_THRESHOLD = 60000; // 60 seconds silence = pause (based on missed heartbeat)
  private readonly TAKEOVER_THRESHOLD = 120000; // 120 seconds silence = takeover allowed
  private readonly PLAN_PREFIX = 'active_plan';

  constructor() {
    // Using SullaSettingsModel for multi-tier storage
  }

  static getInstance(): ActivePlanManager {
    if (!ActivePlanManager.instance) {
      ActivePlanManager.instance = new ActivePlanManager();
    }
    return ActivePlanManager.instance;
  }

  /**
   * Register a new active plan when planning starts with PID tracking
   */
  async registerActivePlan(
    threadId: string,
    planId: string,
    goal: string,
    skillSlug: string | null,
    skillTitle: string | null
  ): Promise<string> {
    const instanceId = `instance_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const executorPID = `pid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    const activePlan: ActivePlan = {
      planId,
      threadId,
      goal,
      skillSlug,
      skillTitle,
      startedAt: now,
      lastHeartbeat: now,
      instanceId,
      executorPID,
      status: 'planning',
      heartbeatCount: 0,
      takeoverAllowed: false,
      nextHeartbeatDue: now + this.DEFAULT_HEARTBEAT_INTERVAL,
      currentHeartbeatInterval: this.DEFAULT_HEARTBEAT_INTERVAL
    };

    try {
      const planKey = `${this.PLAN_PREFIX}:${threadId}:${planId}`;
      
      await SullaSettingsModel.set(planKey, activePlan, 'json');
      
      console.log(`[ActivePlanManager] Registered active plan: ${planId}`);
      console.log(`[ActivePlanManager] Executor PID: ${executorPID}`);
      console.log(`[ActivePlanManager] Goal: "${goal}"`);
      console.log(`[ActivePlanManager] Skill: ${skillTitle || 'General Planning'}`);
      
      return executorPID;
    } catch (error) {
      console.error('[ActivePlanManager] Failed to register active plan:', error);
      throw error;
    }
  }

  /**
   * Remove active plan when it completes
   */
  async removeActivePlan(threadId: string, planId: string): Promise<void> {
    try {
      const planKey = `${this.PLAN_PREFIX}:${threadId}:${planId}`;
      
      await SullaSettingsModel.delete(planKey);
      
      console.log(`[ActivePlanManager] Removed completed plan: ${planId}`);
    } catch (error) {
      console.error('[ActivePlanManager] Failed to remove active plan:', error);
    }
  }

  /**
   * Get all active plans for a thread
   */
  async getActivePlans(threadId: string): Promise<ActivePlan[]> {
    try {
      // Get all plans matching the thread pattern
      const pattern = `${this.PLAN_PREFIX}:${threadId}:*`;
      const planData = await SullaSettingsModel.getByPattern(pattern);
      
      const activePlans: ActivePlan[] = [];
      for (const [key, data] of Object.entries(planData)) {
        try {
          // Data is already parsed by SullaSettingsModel due to 'json' cast
          const plan = data as ActivePlan;
          activePlans.push(plan);
        } catch (parseError) {
          console.warn(`[ActivePlanManager] Failed to parse plan data for ${key}:`, parseError);
        }
      }

      return activePlans;
    } catch (error) {
      console.error('[ActivePlanManager] Failed to get active plans:', error);
      return [];
    }
  }

  /**
   * Get skills currently being worked on (to filter from skill triggers)
   */
  async getActiveSkills(threadId: string): Promise<{
    skillSlugs: string[];
    skillTitles: string[];
    planSummaries: ActivePlanSummary[];
  }> {
    const activePlans = await this.getActivePlans(threadId);
    
    const skillSlugs: string[] = [];
    const skillTitles: string[] = [];
    const planSummaries: ActivePlanSummary[] = [];
    
    for (const plan of activePlans) {
      if (plan.skillSlug && plan.skillTitle) {
        skillSlugs.push(plan.skillSlug);
        skillTitles.push(plan.skillTitle);
      }
      
      planSummaries.push({
        planId: plan.planId,
        goal: plan.goal,
        skillTitle: plan.skillTitle,
        startedAt: plan.startedAt,
        duration: Date.now() - plan.startedAt
      });
    }

    console.log(`[ActivePlanManager] Found ${activePlans.length} active plans for thread ${threadId}`);
    console.log(`[ActivePlanManager] Active skills: ${skillTitles.join(', ') || 'None'}`);

    return { skillSlugs, skillTitles, planSummaries };
  }

  /**
   * Check if a specific skill is currently being worked on
   */
  async isSkillActive(threadId: string, skillSlug: string): Promise<boolean> {
    const activeSkills = await this.getActiveSkills(threadId);
    return activeSkills.skillSlugs.includes(skillSlug);
  }

  // NOTE: filterSkillTriggers method removed - we no longer filter skills
  // Instead, we allow selecting the same skills for plan monitoring and status checking

  /**
   * Send heartbeat for active plan with custom next interval
   * Executors can specify when they want to be checked next
   */
  async sendHeartbeat(threadId: string, planId: string, executorPID: string, nextIntervalMs?: number): Promise<{
    success: boolean;
    stillResponsible: boolean;
    shouldAbort: boolean;
    nextHeartbeatDue: number;
  }> {
    try {
      const planKey = `${this.PLAN_PREFIX}:${threadId}:${planId}`;
      
      const plan = await SullaSettingsModel.get(planKey, null) as ActivePlan;
      if (!plan) {
        return { success: false, stillResponsible: false, shouldAbort: true, nextHeartbeatDue: 0 };
      }
      
      // Check if this executor is still responsible for the plan
      if (plan.executorPID !== executorPID) {
        console.log(`[ActivePlanManager] Executor ${executorPID} no longer responsible for plan ${planId}`);
        console.log(`[ActivePlanManager] Current responsible executor: ${plan.executorPID}`);
        return { success: false, stillResponsible: false, shouldAbort: true, nextHeartbeatDue: 0 };
      }
      
      // Update heartbeat with custom interval
      const now = Date.now();
      plan.lastHeartbeat = now;
      plan.heartbeatCount += 1;
      
      // Set next heartbeat interval (with bounds checking)
      const requestedInterval = nextIntervalMs || this.DEFAULT_HEARTBEAT_INTERVAL;
      const clampedInterval = Math.max(
        this.MIN_HEARTBEAT_INTERVAL,
        Math.min(this.MAX_HEARTBEAT_INTERVAL, requestedInterval)
      );
      
      plan.currentHeartbeatInterval = clampedInterval;
      plan.nextHeartbeatDue = now + clampedInterval;
      
      // Reset paused status if it was paused
      if (plan.status === 'paused') {
        plan.status = 'executing';
        plan.takeoverAllowed = false;
      }
      
      await SullaSettingsModel.set(planKey, plan, 'json');
      
      const intervalSeconds = Math.floor(clampedInterval / 1000);
      console.log(`[ActivePlanManager] Heartbeat received from ${executorPID} (count: ${plan.heartbeatCount})`);
      console.log(`[ActivePlanManager] Next heartbeat expected in ${intervalSeconds}s (${new Date(plan.nextHeartbeatDue).toLocaleTimeString()})`);
      
      return { success: true, stillResponsible: true, shouldAbort: false, nextHeartbeatDue: plan.nextHeartbeatDue };
      
    } catch (error) {
      console.error('[ActivePlanManager] Failed to send heartbeat:', error);
      return { success: false, stillResponsible: false, shouldAbort: true, nextHeartbeatDue: 0 };
    }
  }

  /**
   * Check for stalled plans and mark them for takeover
   */
  async checkForStalledPlans(threadId: string): Promise<{
    pausedPlans: string[];
    takeoverAvailable: string[];
  }> {
    const activePlans = await this.getActivePlans(threadId);
    const now = Date.now();
    const pausedPlans: string[] = [];
    const takeoverAvailable: string[] = [];
    
    for (const plan of activePlans) {
      const timeSinceHeartbeat = now - plan.lastHeartbeat;
      
      // Mark as paused if no heartbeat for 60 seconds
      if (timeSinceHeartbeat > this.PAUSE_THRESHOLD && plan.status === 'executing') {
        plan.status = 'paused';
        plan.takeoverAllowed = false;
        
        try {
          const planKey = `${this.PLAN_PREFIX}:${threadId}:${plan.planId}`;
          await SullaSettingsModel.set(planKey, plan, 'json');
          
          pausedPlans.push(plan.planId);
          console.log(`[ActivePlanManager] Plan ${plan.planId} marked as PAUSED (${Math.floor(timeSinceHeartbeat / 1000)}s silence)`);
        } catch (error) {
          console.error('[ActivePlanManager] Failed to update paused plan:', error);
        }
      }
      
      // Allow takeover if no heartbeat for 120 seconds
      if (timeSinceHeartbeat > this.TAKEOVER_THRESHOLD && (plan.status === 'paused' || plan.status === 'executing')) {
        plan.takeoverAllowed = true;
        
        try {
          const planKey = `${this.PLAN_PREFIX}:${threadId}:${plan.planId}`;
          await SullaSettingsModel.set(planKey, plan, 'json');
          
          takeoverAvailable.push(plan.planId);
          console.log(`[ActivePlanManager] Plan ${plan.planId} available for TAKEOVER (${Math.floor(timeSinceHeartbeat / 1000)}s silence)`);
        } catch (error) {
          console.error('[ActivePlanManager] Failed to update takeover plan:', error);
        }
      }
    }
    
    return { pausedPlans, takeoverAvailable };
  }

  /**
   * Attempt to take over a stalled plan
   */
  async attemptPlanTakeover(threadId: string, planId: string): Promise<{
    success: boolean;
    newExecutorPID: string | null;
    previousExecutor: string | null;
  }> {
    try {
      const planKey = `${this.PLAN_PREFIX}:${threadId}:${planId}`;
      
      const plan = await SullaSettingsModel.get(planKey, null) as ActivePlan;
      if (!plan) {
        return { success: false, newExecutorPID: null, previousExecutor: null };
      }
      
      // Only allow takeover if plan is marked as available
      if (!plan.takeoverAllowed) {
        console.log(`[ActivePlanManager] Takeover not allowed for plan ${planId} (not stalled enough)`);
        return { success: false, newExecutorPID: null, previousExecutor: null };
      }
      
      const previousExecutor = plan.executorPID;
      const newExecutorPID = `pid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = Date.now();
      
      // Transfer ownership
      plan.executorPID = newExecutorPID;
      plan.lastHeartbeat = now;
      plan.status = 'executing';
      plan.takeoverAllowed = false;
      plan.heartbeatCount = 0;
      
      await SullaSettingsModel.set(planKey, plan, 'json');
      
      console.log(`[ActivePlanManager] Plan ${planId} taken over`);
      console.log(`[ActivePlanManager] Previous executor: ${previousExecutor}`);
      console.log(`[ActivePlanManager] New executor: ${newExecutorPID}`);
      
      return { success: true, newExecutorPID, previousExecutor };
      
    } catch (error) {
      console.error('[ActivePlanManager] Failed to attempt plan takeover:', error);
      return { success: false, newExecutorPID: null, previousExecutor: null };
    }
  }

  /**
   * Check if current executor is still responsible for plan
   */
  async isExecutorResponsible(threadId: string, planId: string, executorPID: string): Promise<boolean> {
    try {
      const planKey = `${this.PLAN_PREFIX}:${threadId}:${planId}`;
      
      const plan = await SullaSettingsModel.get(planKey, null) as ActivePlan;
      if (!plan) {
        return false;
      }
      
      return plan.executorPID === executorPID;
      
    } catch (error) {
      console.error('[ActivePlanManager] Failed to check executor responsibility:', error);
      return false;
    }
  }

  /**
   * Update plan status (planning -> executing -> completed)
   */
  async updatePlanStatus(threadId: string, planId: string, executorPID: string, status: ActivePlan['status']): Promise<boolean> {
    try {
      const planKey = `${this.PLAN_PREFIX}:${threadId}:${planId}`;
      
      const plan = await SullaSettingsModel.get(planKey, null) as ActivePlan;
      if (!plan) {
        return false;
      }
      
      // Only allow updates from responsible executor
      if (plan.executorPID !== executorPID) {
        console.log(`[ActivePlanManager] Status update rejected - executor ${executorPID} not responsible`);
        return false;
      }
      
      plan.status = status;
      plan.lastHeartbeat = Date.now();
      
      await SullaSettingsModel.set(planKey, plan, 'json');
      console.log(`[ActivePlanManager] Updated plan ${planId} status to: ${status}`);
      return true;
      
    } catch (error) {
      console.error('[ActivePlanManager] Failed to update plan status:', error);
      return false;
    }
  }

  /**
   * Get active plan summary for display in PlanRetrievalNode
   */
  async getActivePlanSummary(threadId: string): Promise<string> {
    const { planSummaries } = await this.getActiveSkills(threadId);
    
    if (planSummaries.length === 0) {
      return 'No active plans currently running.';
    }

    const summaryLines = planSummaries.map(plan => {
      const durationMinutes = Math.floor(plan.duration / (1000 * 60));
      const skillInfo = plan.skillTitle ? ` using ${plan.skillTitle}` : ' (general planning)';
      return `- **${plan.goal}**${skillInfo} (running ${durationMinutes}m)`;
    });

    return `**Currently Active Plans (${planSummaries.length})**:\n${summaryLines.join('\n')}`;
  }

  /**
   * Cleanup abandoned plans (called periodically)
   */
  async cleanupAbandonedPlans(threadId: string): Promise<number> {
    const activePlans = await this.getActivePlans(threadId);
    const now = Date.now();
    const maxAge = this.PLAN_TTL * 1000; // Convert to milliseconds
    
    let cleanedCount = 0;
    
    for (const plan of activePlans) {
      const age = now - plan.startedAt;
      if (age > maxAge) {
        await this.removeActivePlan(threadId, plan.planId);
        cleanedCount++;
        console.log(`[ActivePlanManager] Cleaned up abandoned plan: ${plan.planId} (age: ${Math.floor(age / (1000 * 60))}m)`);
      }
    }

    return cleanedCount;
  }
}
