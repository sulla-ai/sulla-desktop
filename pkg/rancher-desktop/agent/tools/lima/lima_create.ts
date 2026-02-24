import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Lima Create Tool - Worker class for execution
 */
export class LimaCreateWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { template } = input;

    const args = ['create'];

    if (template) {
      args.push(template);
    }

    try {
      const res = await runCommand('limactl', args, { timeoutMs: 300_000, maxOutputChars: 160_000 }); // Longer timeout for creating

      if (res.exitCode !== 0) {
        return {
          successBoolean: false,
          responseString: `Error creating Lima VM: ${res.stderr || res.stdout}`
        };
      }

      const responseString = `Lima VM created${template ? ` using template ${template}` : ''}\nOutput:\n${res.stdout}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing limactl create: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const limaCreateRegistration: ToolRegistration = {
  name: "lima_create",
  description: "Create a Lima virtual machine instance.",
  category: "lima",
  operationTypes: ['create'],
  schemaDef: {
    template: { type: 'string' as const, optional: true, description: "Absolute path to YAML file" },
  },
  workerClass: LimaCreateWorker,
};
