/**
 * Sulla-specific IPC event handlers for the Agent UI.
 */

import { getIpcMainProxy } from '@pkg/main/ipcMain';
import Logging from '@pkg/utils/logging';
import * as childProcess from '@pkg/utils/childProcess';

const console = Logging.background;
const ipcMainProxy = getIpcMainProxy(console);

/**
 * Initialize Sulla-specific IPC handlers.
 */
export function initSullaEvents(): void {
  // Handle Ollama pod restart requests from the Agent UI
  ipcMainProxy.handle('sulla-restart-ollama', async() => {
    console.log('[Sulla] Restarting Ollama pod to free memory...');

    try {
      // Delete the Ollama pod - K8s will recreate it automatically
      await childProcess.spawnFile('kubectl', [
        'delete', 'pod',
        '-n', 'sulla',
        '-l', 'app=ollama',
        '--wait=false',
      ], { stdio: ['ignore', 'pipe', 'pipe'] });

      console.log('[Sulla] Ollama pod restart initiated');
    } catch (err) {
      console.error('[Sulla] Failed to restart Ollama pod:', err);
      throw err;
    }
  });

  console.log('[Sulla] IPC event handlers initialized');
}
