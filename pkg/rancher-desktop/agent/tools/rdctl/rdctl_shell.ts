import { BaseTool, ToolRegistration } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Rdctl Shell Tool - Worker class for execution
 */
export class RdctlShellWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { command } = input;

    const args = ['shell'];

    if (command) {
      args.push('--', command);
    }

    try {
      const res = await runCommand('rdctl', args, { timeoutMs: command ? 60_000 : 300_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing rdctl shell: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const rdctlShellRegistration: ToolRegistration = {
  name: "rdctl_shell",
  description: "Run an interactive shell or a command in a Sulla Desktop-managed VM.",
  category: "rdctl",
  schemaDef: {
    command: { type: 'string' as const, optional: true, description: "Command to execute in the VM shell" },
  },
  workerClass: RdctlShellWorker,
};
