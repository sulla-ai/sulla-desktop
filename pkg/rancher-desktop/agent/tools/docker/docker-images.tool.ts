import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class DockerImagesTool extends BaseTool {
  name = "docker_images";
  description = "List Docker images.";
  schema = z.object({
    all: z.boolean().optional().describe("Show all images (default: only top-level images)"),
  });

  metadata = { category: "docker" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { all } = input;

    const args = ['images'];
    if (all) {
      args.push('-a');
    }

    try {
      const res = await runCommand('docker', args, { timeoutMs: 30000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing docker images: ${(error as Error).message}`;
    }
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('docker_images', async () => new DockerImagesTool(), 'docker');
