import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Lima Delete Tool - Worker class for execution
 */
export class LimaDeleteWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { instance, force } = input;

    const args = ['delete', instance];

    if (force) {
      args.push('--force');
    }

    try {
      const res = await runCommand('limactl', args, { timeoutMs: 120_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return {
          successBoolean: false,
          responseString: `Error deleting Lima VM: ${res.stderr || res.stdout}`
        };
      }

      const responseString = `Lima VM ${instance} deleted${force ? ' (force)' : ''}\nOutput:\n${res.stdout}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing limactl delete: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const limaDeleteRegistration: ToolRegistration = {
  name: "lima_delete",
  description: "Delete a Lima virtual machine instance.",
  category: "lima",
  operationTypes: ['delete'],
  schemaDef: {
    instance: { type: 'string' as const, description: "Name of the Lima instance" },
    force: { type: 'boolean' as const, optional: true, description: "Force deletion without confirmation" },
  },
  workerClass: LimaDeleteWorker,
};
