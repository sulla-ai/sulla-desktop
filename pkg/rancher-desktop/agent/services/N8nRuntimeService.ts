import { getN8nBridgeService, N8nBridgeService } from './N8nBridgeService';

let startPromise: Promise<void> | null = null;

export interface N8nRuntime {
  bridge: N8nBridgeService;
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

  return {
    bridge,
  };
}
