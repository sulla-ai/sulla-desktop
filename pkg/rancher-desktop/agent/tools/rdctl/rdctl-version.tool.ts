import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class RdctlVersionTool extends BaseTool {
  name = "sullactl_version";
  description = "Shows the CLI version.";
  schema = z.object({});

  metadata = { category: "rdctl" };

  protected async _call(input: z.infer<this["schema"]>) {
    try {
      const res = await runCommand('rdctl', ['version'], { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing rdctl version: ${(error as Error).message}`;
    }
  }
}
