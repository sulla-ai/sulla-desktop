import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class RdctlExtensionTool extends BaseTool {
  name = "rdctl_extension";
  description = "Manage extensions.";
  schema = z.object({
    subcommand: z.string().describe("Extension subcommand, e.g., install, uninstall, list"),
    args: z.array(z.string()).optional().describe("Arguments for the subcommand"),
  });

  metadata = { category: "rdctl" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { subcommand, args = [] } = input;

    const cmdArgs = ['extension', subcommand, ...args];

    try {
      const res = await runCommand('rdctl', cmdArgs, { timeoutMs: 120_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing rdctl extension: ${(error as Error).message}`;
    }
  }
}
