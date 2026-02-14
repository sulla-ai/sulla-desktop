import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class RdctlInfoTool extends BaseTool {
  name = "sullactl_info";
  description = "Return information about Sulla Desktop.";
  schema = z.object({});

  metadata = { category: "rdctl" };

  protected async _call(input: z.infer<this["schema"]>) {
    try {
      const res = await runCommand('rdctl', ['info'], { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing rdctl info: ${(error as Error).message}`;
    }
  }
}
