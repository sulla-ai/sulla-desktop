import { BaseTool, ToolRegistration } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Rdctl Shutdown Tool - Worker class for execution
 */
export class RdctlShutdownWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    try {
      const res = await runCommand('rdctl', ['shutdown'], { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing rdctl shutdown: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const rdctlShutdownRegistration: ToolRegistration = {
  name: "rdctl_shutdown",
  description: "Shuts down the running Sulla Desktop application.",
  category: "rdctl",
  schemaDef: {},
  workerClass: RdctlShutdownWorker,
};
