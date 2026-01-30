import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { getAgentConfig } from '../services/ConfigService';
import { getLLMConfig } from '../services/LLMServiceFactory';
import { getRemoteModelService } from '../services/RemoteModelService';

export class AgentGetSettingsTool extends BaseTool {
  override readonly name = 'agent_get_settings';

  override getPlanningInstructions(): string {
    return [
      '20) agent_get_settings (Agent settings)',
      '   - Purpose: Inspect the agent\'s current runtime settings (LLM mode/model/provider/retry/timeout).',
      '   - Output: A JSON snapshot of current settings/config.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, _context: ToolContext): Promise<ToolResult> {
    try {
      const agentConfig = getAgentConfig();
      const llmConfig = getLLMConfig();

      const remote = getRemoteModelService();
      const remoteRuntime = {
        retryCount: remote.getRetryCount(),
        defaultTimeoutMs: remote.getDefaultTimeoutMs(),
        model: remote.getModel(),
        isAvailable: remote.isAvailable(),
      };

      return {
        toolName: this.name,
        success: true,
        result: {
          agentConfig,
          llmConfig,
          remoteRuntime,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
