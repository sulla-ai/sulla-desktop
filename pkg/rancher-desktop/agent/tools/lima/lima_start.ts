import { BaseTool, ToolRegistration } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Lima Start Tool - Worker class for execution
 */
export class LimaStartWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { instance } = input;

    const args = ['start', instance];

    try {
      const res = await runCommand('limactl', args, { timeoutMs: 300_000, maxOutputChars: 160_000 }); // Longer timeout for starting

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing limactl start: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const limaStartRegistration: ToolRegistration = {
  name: "lima_start",
  description: "Start a Lima virtual machine instance.",
  category: "lima",
  schemaDef: {
    instance: { type: 'string' as const, description: "Name of the Lima instance" },
  },
  workerClass: LimaStartWorker,
};
