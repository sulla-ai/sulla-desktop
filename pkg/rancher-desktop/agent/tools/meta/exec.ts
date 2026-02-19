import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Exec Tool - Worker class for execution
 */
export class ExecWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { command } = input;

    // Guardrails: block dangerous commands
    const forbiddenPatterns = [
      /rm\s+-rf/i,
      /sudo/i,
      /dd\s+/i,
      /mkfs/i,
      /format/i,
      /:(){.*:|\|:}/, // fork bomb
      /shutdown/i,
      /halt/i,
      /reboot/i,
      /poweroff/i,
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(command)) {
        return {
          successBoolean: false,
          responseString: `ERROR: Command blocked for security reasons. Pattern: ${pattern.source}`
        };
      }
    }

    try {
      const res = await runCommand(command, [], {
        timeoutMs: 30000,
        maxOutputChars: 160_000,
        runInLimaShell: true,
      });

      if (res.exitCode !== 0) {
        return {
          successBoolean: false,
          responseString: `Command failed with exit code ${res.exitCode}:\n${res.stderr || res.stdout}`
        };
      }

      return {
        successBoolean: true,
        responseString: res.stdout
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing command: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const execRegistration: ToolRegistration = {
  name: "exec",
  description: "Execute a shell command and return output. Use only when explicitly needed.",
  category: "meta",
  schemaDef: {
    command: { type: 'string' as const, description: 'The exact shell command to run' },
  },
  workerClass: ExecWorker,
};
