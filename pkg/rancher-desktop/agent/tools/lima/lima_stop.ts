import { BaseTool, ToolRegistration } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Lima Stop Tool - Worker class for execution
 */
export class LimaStopWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { instance } = input;

    const args = ['stop', instance];

    try {
      const res = await runCommand('limactl', args, { timeoutMs: 120_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing limactl stop: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const limaStopRegistration: ToolRegistration = {
  name: "lima_stop",
  description: "Stop a Lima virtual machine instance.",
  category: "lima",
  schemaDef: {
    instance: { type: 'string' as const, description: "Name of the Lima instance" },
  },
  workerClass: LimaStopWorker,
};
