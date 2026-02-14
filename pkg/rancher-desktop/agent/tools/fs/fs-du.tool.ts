import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class FsDuTool extends BaseTool {
  name = "fs_du";
  description = "Estimate file space usage.";
  schema = z.object({
    path: z.string().optional().describe("Path to file or directory (default: current directory)"),
    options: z.string().optional().describe("Additional du options, e.g., '-h'"),
  });

  metadata = { category: "file system" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { path, options } = input;

    const args = [];
    if (options) args.push(options);
    if (path) args.push(path);

    try {
      const res = await runCommand('du', args, { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing du: ${(error as Error).message}`;
    }
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('fs_du', async () => new FsDuTool(), 'file system');
