import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Rdctl Shutdown Tool - Worker class for execution
 */
export class RdctlShutdownWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const res = await runCommand('rdctl', ['shutdown'], { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return {
          successBoolean: false,
          responseString: `Error shutting down Sulla Desktop: ${res.stderr || res.stdout}`
        };
      }

      return {
        successBoolean: true,
        responseString: `Sulla Desktop shut down successfully.\nOutput:\n${res.stdout}`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing rdctl shutdown: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const rdctlShutdownRegistration: ToolRegistration = {
  name: "rdctl_shutdown",
  description: "Shuts down the running Sulla Desktop application.",
  category: "rdctl",
  schemaDef: {},
  workerClass: RdctlShutdownWorker,
};
