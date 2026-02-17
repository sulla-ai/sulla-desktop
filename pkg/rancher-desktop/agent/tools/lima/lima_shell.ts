import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Lima Shell Tool - Worker class for execution
 */
export class LimaShellWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { instance, command } = input;

    const args = ['shell', instance];

    if (command) {
      args.push('--', command);
    }

    try {
      const res = await runCommand('limactl', args, { timeoutMs: command ? 60_000 : 300_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return {
          successBoolean: false,
          responseString: `Error executing command in Lima VM: ${res.stderr || res.stdout}`
        };
      }

      const responseString = `Command executed in Lima VM ${instance}${command ? `: ${command}` : ' (interactive shell)'}\nOutput:\n${res.stdout}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing limactl shell: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const limaShellRegistration: ToolRegistration = {
  name: "lima_shell",
  description: "Execute a command in a Lima virtual machine instance.",
  category: "lima",
  schemaDef: {
    instance: { type: 'string' as const, description: "Name of the Lima instance" },
    command: { type: 'string' as const, optional: true, description: "Command to execute, if not provided, enters interactive shell" },
  },
  workerClass: LimaShellWorker,
};
