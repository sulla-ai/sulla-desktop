import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Rdctl Info Tool - Worker class for execution
 */
export class RdctlInfoWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const res = await runCommand('rdctl', ['info'], { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return {
          successBoolean: false,
          responseString: `Error getting rdctl info: ${res.stderr || res.stdout}`
        };
      }

      return {
        successBoolean: true,
        responseString: `Sulla Desktop Information:\n${res.stdout}`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing rdctl info: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const rdctlInfoRegistration: ToolRegistration = {
  name: "rdctl_info",
  description: "Return information about Sulla Desktop.",
  category: "rdctl",
  operationTypes: ['read'],
  schemaDef: {},
  workerClass: RdctlInfoWorker,
};
