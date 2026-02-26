/**
 * hostBridgeAccessor.ts
 *
 * Singleton accessor so backend tool code can reach the active
 * WebviewHostBridge instance that was attached in the Vue layer.
 */

import { WebviewHostBridge } from './WebviewHostBridge';

let activeBridge: WebviewHostBridge | null = null;

export function setActiveHostBridge(bridge: WebviewHostBridge | null): void {
  activeBridge = bridge;
}

export function getActiveHostBridge(): WebviewHostBridge | null {
  return activeBridge;
}
