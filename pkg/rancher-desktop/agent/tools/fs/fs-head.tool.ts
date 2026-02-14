import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class FsHeadTool extends BaseTool {
  name = "fs_head";
  description = "Display the first part of a file.";
  schema = z.object({
    file: z.string().describe("Path to the file"),
    lines: z.number().optional().describe("Number of lines to display (default: 10)"),
  });

  metadata = { category: "fs" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { file, lines = 10 } = input;

    const args = ['-n', lines.toString(), file];

    try {
      const res = await runCommand('head', args, { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing head: ${(error as Error).message}`;
    }
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('fs_head', async () => new FsHeadTool(), 'fs');
