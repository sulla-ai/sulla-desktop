import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Rdctl Extension Tool - Worker class for execution
 */
export class RdctlExtensionWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { subcommand, args = [] } = input;

    const cmdArgs = ['extension', subcommand, ...args];

    try {
      const res = await runCommand('rdctl', cmdArgs, { timeoutMs: 120_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return {
          successBoolean: false,
          responseString: `Error executing extension command: ${res.stderr || res.stdout}`
        };
      }

      return {
        successBoolean: true,
        responseString: `Extension command executed: ${subcommand}${args.length ? ` ${args.join(' ')}` : ''}\nOutput:\n${res.stdout}`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing rdctl extension: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const rdctlExtensionRegistration: ToolRegistration = {
  name: "rdctl_extension",
  description: "Manage extensions.",
  category: "rdctl",
  operationTypes: ['execute'],
  schemaDef: {
    subcommand: { type: 'string' as const, description: "Extension subcommand, e.g., install, uninstall, list" },
    args: { type: 'array' as const, items: { type: 'string' as const }, optional: true, description: "Arguments for the subcommand" },
  },
  workerClass: RdctlExtensionWorker,
};
