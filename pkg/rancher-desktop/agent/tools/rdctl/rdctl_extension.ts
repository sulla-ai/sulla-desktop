import { BaseTool, ToolRegistration } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Rdctl Extension Tool - Worker class for execution
 */
export class RdctlExtensionWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { subcommand, args = [] } = input;

    const cmdArgs = ['extension', subcommand, ...args];

    try {
      const res = await runCommand('rdctl', cmdArgs, { timeoutMs: 120_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing rdctl extension: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const rdctlExtensionRegistration: ToolRegistration = {
  name: "rdctl_extension",
  description: "Manage extensions.",
  category: "rdctl",
  schemaDef: {
    subcommand: { type: 'string' as const, description: "Extension subcommand, e.g., install, uninstall, list" },
    args: { type: 'array' as const, items: { type: 'string' as const }, optional: true, description: "Arguments for the subcommand" },
  },
  workerClass: RdctlExtensionWorker,
};
