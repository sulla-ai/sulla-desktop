import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Rdctl Start Tool - Worker class for execution
 */
export class RdctlStartWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const res = await runCommand('rdctl', ['start'], { timeoutMs: 300_000, maxOutputChars: 160_000 }); // Longer timeout for starting

      if (res.exitCode !== 0) {
        return {
          successBoolean: false,
          responseString: `Error starting Sulla Desktop: ${res.stderr || res.stdout}`
        };
      }

      return {
        successBoolean: true,
        responseString: `Sulla Desktop started successfully.\nOutput:\n${res.stdout}`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing rdctl start: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const rdctlStartRegistration: ToolRegistration = {
  name: "rdctl_start",
  description: "Start up Sulla Desktop, or update its settings.",
  category: "rdctl",
  operationTypes: ['execute'],
  schemaDef: {},
  workerClass: RdctlStartWorker,
};
