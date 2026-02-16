import { BaseTool, ToolRegistration } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Rdctl Version Tool - Worker class for execution
 */
export class RdctlVersionWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    try {
      const res = await runCommand('rdctl', ['version'], { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing rdctl version: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const rdctlVersionRegistration: ToolRegistration = {
  name: "rdctl_version",
  description: "Shows the CLI version.",
  category: "rdctl",
  schemaDef: {},
  workerClass: RdctlVersionWorker,
};
