import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class FsCatTool extends BaseTool {
  name = "fs_cat";
  description = "Display file contents.";
  schema = z.object({
    file: z.string().describe("Path to the file to display"),
  });

  metadata = { category: "file system" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { file } = input;

    try {
      const res = await runCommand('cat', [file], { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing cat: ${(error as Error).message}`;
    }
  }
}
