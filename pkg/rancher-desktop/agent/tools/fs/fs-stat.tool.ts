import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class FsStatTool extends BaseTool {
  name = "fs_stat";
  description = "Display file or filesystem status.";
  schema = z.object({
    file: z.string().describe("Path to file or filesystem"),
    options: z.string().optional().describe("Additional stat options"),
  });

  metadata = { category: "file system" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { file, options } = input;

    const args = [];
    if (options) args.push(options);
    args.push(file);

    try {
      const res = await runCommand('stat', args, { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing stat: ${(error as Error).message}`;
    }
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('fs_stat', async () => new FsStatTool(), 'file system');
