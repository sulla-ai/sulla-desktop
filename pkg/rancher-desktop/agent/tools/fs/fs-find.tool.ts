import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class FsFindTool extends BaseTool {
  name = "fs_find";
  description = "Find files and directories.";
  schema = z.object({
    path: z.string().describe("Starting path for the search"),
    name: z.string().optional().describe("Name pattern to match"),
    type: z.string().optional().describe("File type (f=file, d=directory)"),
    options: z.string().optional().describe("Additional find options"),
  });

  metadata = { category: "file system" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { path, name, type, options } = input;

    const args = [path];
    if (name) {
      args.push('-name', name);
    }
    if (type) {
      args.push('-type', type);
    }
    if (options) {
      args.push(...options.split(' '));
    }

    try {
      const res = await runCommand('find', args, { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing find: ${(error as Error).message}`;
    }
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('fs_find', async () => new FsFindTool(), 'file system');
