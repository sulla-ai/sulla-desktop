import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { ipcRenderer } from '../../utils/ipcRenderer';
import { updateAgentConfigFull } from '../services/ConfigService';

type ExperimentalSettingsPatch = {
  sullaModel?: string;
  modelMode?: 'local' | 'remote';
  remoteProvider?: string;
  remoteModel?: string;
  remoteApiKey?: string;
  remoteRetryCount?: number;
  remoteTimeoutSeconds?: number;
};

export class AgentUpdateSettingsTool extends BaseTool {
  override readonly name = 'agent_update_settings';

  override getPlanningInstructions(): string {
    return [
      '21) agent_update_settings (Agent settings)',
      '   - Purpose: Update the agent\'s settings (LLM mode/model/provider/retry/timeout).',
      '   - Args:',
      '     - patch (object, required) allowlisted experimental settings keys',
      '   - Output: Applied patch + confirmation.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    try {
      const patchRaw = context.args?.patch;
      if (!patchRaw || typeof patchRaw !== 'object') {
        return { toolName: this.name, success: false, error: 'Missing args.patch (object)' };
      }

      const patch = patchRaw as ExperimentalSettingsPatch;

      const allowlisted: ExperimentalSettingsPatch = {};
      if (patch.sullaModel !== undefined) {
        allowlisted.sullaModel = String(patch.sullaModel);
      }
      if (patch.modelMode !== undefined) {
        allowlisted.modelMode = patch.modelMode === 'remote' ? 'remote' : 'local';
      }
      if (patch.remoteProvider !== undefined) {
        allowlisted.remoteProvider = String(patch.remoteProvider);
      }
      if (patch.remoteModel !== undefined) {
        allowlisted.remoteModel = String(patch.remoteModel);
      }
      if (patch.remoteApiKey !== undefined) {
        allowlisted.remoteApiKey = String(patch.remoteApiKey);
      }
      if (patch.remoteRetryCount !== undefined) {
        allowlisted.remoteRetryCount = Number(patch.remoteRetryCount);
      }
      if (patch.remoteTimeoutSeconds !== undefined) {
        allowlisted.remoteTimeoutSeconds = Number(patch.remoteTimeoutSeconds);
      }

      await ipcRenderer.invoke('settings-write', { experimental: allowlisted });

      updateAgentConfigFull(allowlisted);

      return {
        toolName: this.name,
        success: true,
        result: {
          applied: allowlisted,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
