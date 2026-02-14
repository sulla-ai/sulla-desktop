import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class RdctlShellTool extends BaseTool {
  name = "rdctl_shell";
  description = "Run an interactive shell or a command in a Sulla Desktop-managed VM.";
  schema = z.object({
    command: z.string().optional().describe("Command to execute in the VM shell"),
  });

  metadata = { category: "rdctl" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { command } = input;

    const args = ['shell'];

    if (command) {
      args.push('--', command);
    }

    try {
      const res = await runCommand('rdctl', args, { timeoutMs: command ? 60_000 : 300_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing rdctl shell: ${(error as Error).message}`;
    }
  }
}
