import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class LimaCreateTool extends BaseTool {
  name = "lima_create";
  description = "Create a Lima virtual machine instance.";
  schema = z.object({
    template: z.string().optional().describe("Absolute path to YAML file"),
  });

  metadata = { category: "lima" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { template } = input;

    const args = ['create'];

    if (template) {
      args.push(template);
    }

    try {
      const res = await runCommand('limactl', args, { timeoutMs: 300_000, maxOutputChars: 160_000 }); // Longer timeout for creating

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing limactl create: ${(error as Error).message}`;
    }
  }
}
