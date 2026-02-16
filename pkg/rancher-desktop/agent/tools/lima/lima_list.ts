import { BaseTool, ToolRegistration } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Lima List Tool - Worker class for execution
 */
export class LimaListWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { json } = input;

    const args = ['list'];

    if (json) {
      args.push('--json');
    }

    try {
      const res = await runCommand('limactl', args, { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing limactl list: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const limaListRegistration: ToolRegistration = {
  name: "lima_list",
  description: "List Lima virtual machine instances.",
  category: "lima",
  schemaDef: {
    json: { type: 'boolean' as const, optional: true, description: "Output in JSON format" },
  },
  workerClass: LimaListWorker,
};
