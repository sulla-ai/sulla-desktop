import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class RdctlStartTool extends BaseTool {
  name = "sullactl_start";
  description = "Start up Sulla Desktop, or update its settings.";
  schema = z.object({});

  metadata = { category: "rdctl" };

  protected async _call(input: z.infer<this["schema"]>) {
    try {
      const res = await runCommand('rdctl', ['start'], { timeoutMs: 300_000, maxOutputChars: 160_000 }); // Longer timeout for starting

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing rdctl start: ${(error as Error).message}`;
    }
  }
}
