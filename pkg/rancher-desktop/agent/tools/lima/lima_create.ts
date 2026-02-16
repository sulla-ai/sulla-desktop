import { BaseTool, ToolRegistration } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Lima Create Tool - Worker class for execution
 */
export class LimaCreateWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { template } = input;

    const args = ['create'];

    if (template) {
      args.push(template);
    }

    try {
      const res = await runCommand('limactl', args, { timeoutMs: 300_000, maxOutputChars: 160_000 }); // Longer timeout for creating

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing limactl create: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const limaCreateRegistration: ToolRegistration = {
  name: "lima_create",
  description: "Create a Lima virtual machine instance.",
  category: "lima",
  schemaDef: {
    template: { type: 'string' as const, optional: true, description: "Absolute path to YAML file" },
  },
  workerClass: LimaCreateWorker,
};
