import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class DockerRunTool extends BaseTool {
  name = "docker_run";
  description = "Run a Docker container.";
  schema = z.object({
    image: z.string().describe("Docker image to run"),
    name: z.string().optional().describe("Container name"),
    command: z.string().optional().describe("Command to run in the container"),
    options: z.string().optional().describe("Additional docker run options"),
  });

  metadata = { category: "docker" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { image, name, command, options } = input;

    const args = ['run'];
    if (options) {
      args.push(...options.split(' '));
    }
    if (name) {
      args.push('--name', name);
    }
    args.push(image);
    if (command) {
      args.push(...command.split(' '));
    }

    try {
      const res = await runCommand('docker', args, { timeoutMs: 120000, maxOutputChars: 160_000 }); // Longer timeout for running containers

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing docker run: ${(error as Error).message}`;
    }
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('docker_run', async () => new DockerRunTool(), 'docker');
