import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class LimaShellTool extends BaseTool {
  name = "lima_shell";
  description = "Execute a command in a Lima virtual machine instance.";
  schema = z.object({
    instance: z.string().describe("Name of the Lima instance"),
    command: z.string().optional().describe("Command to execute, if not provided, enters interactive shell"),
  });

  metadata = { category: "lima" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { instance, command } = input;

    const args = ['shell', instance];

    if (command) {
      args.push('--', command);
    }

    try {
      const res = await runCommand('limactl', args, { timeoutMs: command ? 60_000 : 300_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing limactl shell: ${(error as Error).message}`;
    }
  }
}
