import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class RdctlSetTool extends BaseTool {
  name = "rdctl_set";
  description = "Update selected fields in the Rancher Desktop UI and restart the backend.";
  schema = z.object({
    field: z.string().describe("The field to update"),
    value: z.any().describe("The value to set"),
  });

  metadata = { category: "rdctl" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { field, value } = input;

    const args = ['set', field, value.toString()];

    try {
      const res = await runCommand('rdctl', args, { timeoutMs: 300_000, maxOutputChars: 160_000 }); // Longer timeout for restart

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing rdctl set: ${(error as Error).message}`;
    }
  }
}
