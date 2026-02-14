import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class FsPwdTool extends BaseTool {
  name = "fs_pwd";
  description = "Print the current working directory.";
  schema = z.object({});

  metadata = { category: "file system" };

  protected async _call(input: z.infer<this["schema"]>) {
    try {
      const res = await runCommand('pwd', [], { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout.trim();
    } catch (error) {
      return `Error executing pwd: ${(error as Error).message}`;
    }
  }
}
