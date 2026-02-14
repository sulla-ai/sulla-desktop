import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class DockerBuildTool extends BaseTool {
  name = "docker_build";
  description = "Build a Docker image from a Dockerfile.";
  schema = z.object({
    path: z.string().describe("Path to the directory containing the Dockerfile"),
    tag: z.string().describe("Tag for the built image"),
    options: z.string().optional().describe("Additional docker build options"),
  });

  metadata = { category: "docker" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { path, tag, options } = input;

    const args = ['build'];
    if (options) {
      args.push(...options.split(' '));
    }
    args.push('-t', tag, path);

    try {
      const res = await runCommand('docker', args, { timeoutMs: 300000, maxOutputChars: 160_000 }); // Longer timeout for building

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing docker build: ${(error as Error).message}`;
    }
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('docker_build', async () => new DockerBuildTool(), 'docker');
