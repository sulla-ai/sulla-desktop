import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Rdctl Set Tool - Worker class for execution
 */
export class RdctlSetWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { field, value } = input;

    const args = ['set', field, value.toString()];

    try {
      const res = await runCommand('rdctl', args, { timeoutMs: 300_000, maxOutputChars: 160_000 }); // Longer timeout for restart

      if (res.exitCode !== 0) {
        return {
          successBoolean: false,
          responseString: `Error setting Sulla Desktop setting: ${res.stderr || res.stdout}`
        };
      }

      return {
        successBoolean: true,
        responseString: `Sulla Desktop setting updated successfully: ${field} = ${value}\nOutput:\n${res.stdout}`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing rdctl set: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const rdctlSetRegistration: ToolRegistration = {
  name: "rdctl_set",
  description: "Update selected fields in the Rancher Desktop UI and restart the backend.",
  category: "rdctl",
  schemaDef: {
    field: { type: 'string' as const, description: "The field to update" },
    value: { type: 'string' as const, description: "The value to set (as string)" },
  },
  workerClass: RdctlSetWorker,
};
