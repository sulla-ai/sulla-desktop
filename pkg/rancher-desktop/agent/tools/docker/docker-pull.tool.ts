import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class DockerPullTool extends BaseTool {
  name = "docker_pull";
  description = "Pull a Docker image from a registry.";
  schema = z.object({
    image: z.string().describe("Docker image to pull"),
  });

  metadata = { category: "docker" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { image } = input;

    try {
      const res = await runCommand('docker', ['pull', image], { timeoutMs: 120000, maxOutputChars: 160_000 }); // Longer timeout for pulling

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing docker pull: ${(error as Error).message}`;
    }
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('docker_pull', async () => new DockerPullTool(), 'docker');
