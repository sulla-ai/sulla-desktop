import { getN8nBridgeService, N8nBridgeService } from '../../services/N8nBridgeService';
import { getN8nStateStore, N8nStateStore } from '../../services/N8nStateStore';
import { getN8nEventLog, N8nEventLog } from '../../services/N8nEventLog';

let startPromise: Promise<void> | null = null;

export interface N8nRuntime {
  bridge: N8nBridgeService;
  stateStore: N8nStateStore;
  eventLog: N8nEventLog;
}

export async function getN8nRuntime(): Promise<N8nRuntime> {
  const bridge = getN8nBridgeService();

  if (!startPromise) {
    startPromise = bridge.start().catch((error) => {
      startPromise = null;
      throw error;
    });
  }

  await startPromise;

  const stateStore = getN8nStateStore(bridge);
  const eventLog = getN8nEventLog(bridge, stateStore);

  return {
    bridge,
    stateStore,
    eventLog,
  };
}
