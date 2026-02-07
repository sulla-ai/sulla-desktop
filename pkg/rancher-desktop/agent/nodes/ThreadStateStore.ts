// src/services/ThreadStateStore.ts
import type { HierarchicalThreadState } from '../nodes/Graph';

const threadStore = new Map<string, HierarchicalThreadState>();

export function saveThreadState(state: HierarchicalThreadState): void {
  threadStore.set(state.metadata.threadId, structuredClone(state)); // deep copy
}

export function loadThreadState(threadId: string): HierarchicalThreadState | null {
  const saved = threadStore.get(threadId);
  return saved ? structuredClone(saved) : null;
}

export function deleteThreadState(threadId: string): void {
  threadStore.delete(threadId);
}