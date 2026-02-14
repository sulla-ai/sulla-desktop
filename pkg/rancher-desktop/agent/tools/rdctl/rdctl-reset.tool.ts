import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class RdctlResetTool extends BaseTool {
  name = "rdctl_reset";
  description = "Reset Sulla Desktop.";
  schema = z.object({});

  metadata = { category: "rdctl" };

  protected async _call(input: z.infer<this["schema"]>) {
    try {
      const res = await runCommand('rdctl', ['reset'], { timeoutMs: 300_000, maxOutputChars: 160_000 }); // Longer timeout for reset

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing rdctl reset: ${(error as Error).message}`;
    }
  }
}
