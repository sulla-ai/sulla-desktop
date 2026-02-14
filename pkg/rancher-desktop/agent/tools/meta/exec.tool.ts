import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class ExecTool extends BaseTool {
  name = "exec";
  description = "Execute a shell command and return output. Use only when explicitly needed.";
  schema = z.object({
    command: z.string().describe('The exact shell command to run'),
  });

  metadata = { category: "meta" };

  protected async _call(input: z.infer<this["schema"]>) {
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
        throw new Error(`Dangerous command blocked: ${command}`);
      }
    }

    try {
      const res = await runCommand('sh', ['-c', command], { timeoutMs: 60_000, maxOutputChars: 200_000 });

      if (res.exitCode !== 0) {
        return `Error (exit code ${res.exitCode}):\nstdout: ${res.stdout}\nstderr: ${res.stderr}`;
      }

      return `stdout: ${res.stdout}\nstderr: ${res.stderr}`;
    } catch (error) {
      return `Error executing command: ${(error as Error).message}`;
    }
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('exec', async () => new ExecTool(), 'meta');
