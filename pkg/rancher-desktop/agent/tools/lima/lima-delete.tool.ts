import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class LimaDeleteTool extends BaseTool {
  name = "lima_delete";
  description = "Delete a Lima virtual machine instance.";
  schema = z.object({
    instance: z.string().describe("Name of the Lima instance"),
    force: z.boolean().optional().describe("Force deletion without confirmation"),
  });

  metadata = { category: "lima" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { instance, force } = input;

    const args = ['delete', instance];

    if (force) {
      args.push('--force');
    }

    try {
      const res = await runCommand('limactl', args, { timeoutMs: 120_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing limactl delete: ${(error as Error).message}`;
    }
  }
}
