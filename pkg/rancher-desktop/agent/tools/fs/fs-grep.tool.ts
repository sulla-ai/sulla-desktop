import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class FsGrepTool extends BaseTool {
  name = "fs_grep";
  description = "Search for patterns in files.";
  schema = z.object({
    pattern: z.string().describe("Pattern to search for"),
    file: z.string().optional().describe("File to search in (if not specified, searches stdin)"),
    options: z.string().optional().describe("Additional grep options, e.g., '-r -i'"),
  });

  metadata = { category: "fs" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { pattern, file, options } = input;

    const args = [];
    if (options) {
      args.push(...options.split(' '));
    }
    args.push(pattern);
    if (file) {
      args.push(file);
    }

    try {
      const res = await runCommand('grep', args, { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0 && res.exitCode !== 1) { // grep returns 1 if no matches, which is not an error
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing grep: ${(error as Error).message}`;
    }
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('fs_grep', async () => new FsGrepTool(), 'fs');
