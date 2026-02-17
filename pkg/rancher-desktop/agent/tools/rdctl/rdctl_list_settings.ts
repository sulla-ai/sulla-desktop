import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Rdctl List Settings Tool - Worker class for execution
 */
export class RdctlListSettingsWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const res = await runCommand('rdctl', ['list-settings'], { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return {
          successBoolean: false,
          responseString: `Error listing Sulla Desktop settings: ${res.stderr || res.stdout}`
        };
      }

      return {
        successBoolean: true,
        responseString: `Current Sulla Desktop settings:\n${res.stdout}`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing rdctl list-settings: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const rdctlListSettingsRegistration: ToolRegistration = {
  name: "rdctl_list_settings",
  description: "Lists the current settings.",
  category: "rdctl",
  schemaDef: {},
  workerClass: RdctlListSettingsWorker,
};
