import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class RdctlShutdownTool extends BaseTool {
  name = "rdctl_shutdown";
  description = "Shuts down the running Sulla Desktop application.";
  schema = z.object({});

  metadata = { category: "rdctl" };

  protected async _call(input: z.infer<this["schema"]>) {
    try {
      const res = await runCommand('rdctl', ['shutdown'], { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing rdctl shutdown: ${(error as Error).message}`;
    }
  }
}
