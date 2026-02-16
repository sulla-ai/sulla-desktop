import { BaseTool, ToolRegistration } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Rdctl Set Tool - Worker class for execution
 */
export class RdctlSetWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { field, value } = input;

    const args = ['set', field, value.toString()];

    try {
      const res = await runCommand('rdctl', args, { timeoutMs: 300_000, maxOutputChars: 160_000 }); // Longer timeout for restart

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing rdctl set: ${(error as Error).message}`;
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
