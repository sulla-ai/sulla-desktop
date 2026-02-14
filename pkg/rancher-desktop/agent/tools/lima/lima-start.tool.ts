import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class LimaStartTool extends BaseTool {
  name = "lima_start";
  description = "Start a Lima virtual machine instance.";
  schema = z.object({
    instance: z.string().describe("Name of the Lima instance"),
  });

  metadata = { category: "lima" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { instance } = input;

    const args = ['start', instance];

    try {
      const res = await runCommand('limactl', args, { timeoutMs: 300_000, maxOutputChars: 160_000 }); // Longer timeout for starting

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing limactl start: ${(error as Error).message}`;
    }
  }
}
