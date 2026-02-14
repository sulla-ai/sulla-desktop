import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class FsDfTool extends BaseTool {
  name = "fs_df";
  description = "Report file system disk space usage.";
  schema = z.object({
    options: z.string().optional().describe("Additional df options, e.g., '-h'"),
  });

  metadata = { category: "file system" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { options } = input;

    const args = options ? [options] : [];

    try {
      const res = await runCommand('df', args, { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing df: ${(error as Error).message}`;
    }
  }
}
