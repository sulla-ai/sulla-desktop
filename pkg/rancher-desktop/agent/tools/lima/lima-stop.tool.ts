import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class LimaStopTool extends BaseTool {
  name = "lima_stop";
  description = "Stop a Lima virtual machine instance.";
  schema = z.object({
    instance: z.string().describe("Name of the Lima instance"),
  });

  metadata = { category: "lima" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { instance } = input;

    const args = ['stop', instance];

    try {
      const res = await runCommand('limactl', args, { timeoutMs: 120_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing limactl stop: ${(error as Error).message}`;
    }
  }
}
