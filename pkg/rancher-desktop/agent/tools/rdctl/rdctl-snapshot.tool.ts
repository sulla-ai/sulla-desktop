import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class RdctlSnapshotTool extends BaseTool {
  name = "sullactl_snapshot";
  description = "Manage Sulla Desktop snapshots.";
  schema = z.object({
    subcommand: z.string().describe("Snapshot subcommand, e.g., list, create, delete"),
    args: z.array(z.string()).optional().describe("Arguments for the subcommand"),
  });

  metadata = { category: "rdctl" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { subcommand, args = [] } = input;

    const cmdArgs = ['snapshot', subcommand, ...args];

    try {
      const res = await runCommand('rdctl', cmdArgs, { timeoutMs: 120_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing rdctl snapshot: ${(error as Error).message}`;
    }
  }
}
