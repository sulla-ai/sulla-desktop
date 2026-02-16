import { BaseTool, ToolRegistration } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Lima Delete Tool - Worker class for execution
 */
export class LimaDeleteWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { instance, force } = input;

    const args = ['delete', instance];

    if (force) {
      args.push('--force');
    }

    try {
      const res = await runCommand('limactl', args, { timeoutMs: 120_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing limactl delete: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const limaDeleteRegistration: ToolRegistration = {
  name: "lima_delete",
  description: "Delete a Lima virtual machine instance.",
  category: "lima",
  schemaDef: {
    instance: { type: 'string' as const, description: "Name of the Lima instance" },
    force: { type: 'boolean' as const, optional: true, description: "Force deletion without confirmation" },
  },
  workerClass: LimaDeleteWorker,
};
