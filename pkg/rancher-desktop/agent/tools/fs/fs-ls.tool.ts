import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class FsLsTool extends BaseTool {
  name = "fs_ls";
  description = "List directory contents.";
  schema = z.object({
    path: z.string().optional().describe("Path to directory (default: current directory)"),
    options: z.string().optional().describe("Additional ls options, e.g., '-la'"),
  });

  metadata = { category: "file system" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { path, options } = input;

    const args = [];
    if (options) args.push(options);
    if (path) args.push(path);

    try {
      const res = await runCommand('ls', args, { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing ls: ${(error as Error).message}`;
    }
  }
}
