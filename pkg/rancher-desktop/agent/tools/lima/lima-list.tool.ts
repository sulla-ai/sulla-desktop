import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class LimaListTool extends BaseTool {
  name = "lima_list";
  description = "List Lima virtual machine instances.";
  schema = z.object({
    json: z.boolean().optional().describe("Output in JSON format"),
  });

  metadata = { category: "lima" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { json } = input;

    const args = ['list'];

    if (json) {
      args.push('--json');
    }

    try {
      const res = await runCommand('limactl', args, { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing limactl list: ${(error as Error).message}`;
    }
  }
}
