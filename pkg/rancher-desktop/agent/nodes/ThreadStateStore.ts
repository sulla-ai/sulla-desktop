// src/services/ThreadStateStore.ts
import type { HierarchicalThreadState } from '../nodes/Graph';
import { AgentPlan } from '../database/models/AgentPlan';
import { AgentPlanTodo } from '../database/models/AgentPlanTodo';

const threadStore = new Map<string, HierarchicalThreadState>();

// Helper to reconstruct class instances from plain objects
async function reconstructState(state: HierarchicalThreadState): Promise<HierarchicalThreadState> {
  const reconstructed = structuredClone(state);
  
  // Reconstruct AgentPlan instance if needed
  if (reconstructed.metadata.plan?.model && !(reconstructed.metadata.plan.model instanceof AgentPlan)) {
    console.log('[ThreadStateStore] Reconstructing AgentPlan from database');
    const planId = reconstructed.metadata.plan.model.attributes?.id;
    if (planId) {
      const reloadedPlan = await AgentPlan.find(planId);
      if (reloadedPlan) {
        reconstructed.metadata.plan.model = reloadedPlan;
      } else {
        console.warn('[ThreadStateStore] Plan not found, using existing data');
      }
    }
  }
  
  // Reconstruct AgentPlanTodo instances if needed  
  if (reconstructed.metadata.plan?.milestones) {
    reconstructed.metadata.plan.milestones = await Promise.all(
      reconstructed.metadata.plan.milestones.map(async (milestone) => {
        if (milestone.model && !(milestone.model instanceof AgentPlanTodo)) {
          const todoId = (milestone.model as any).attributes?.id;
          if (todoId) {
            const reloadedTodo = await AgentPlanTodo.find(todoId);
            if (reloadedTodo) {
              milestone.model = reloadedTodo;
            } else {
              console.warn('[ThreadStateStore] Todo not found, using existing data');
            }
          }
        }
        return milestone;
      })
    );
  }
  
  return reconstructed;
}

export function saveThreadState(state: HierarchicalThreadState): void {
  threadStore.set(state.metadata.threadId, structuredClone(state)); // deep copy
}

export async function loadThreadState(threadId: string): Promise<HierarchicalThreadState | null> {
  const saved = threadStore.get(threadId);
  return saved ? await reconstructState(saved) : null;
}

export function deleteThreadState(threadId: string): void {
  threadStore.delete(threadId);
}