import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class DockerExecTool extends BaseTool {
  name = "docker_exec";
  description = "Execute a command in a running Docker container.";
  schema = z.object({
    container: z.string().describe("Container name or ID"),
    command: z.string().describe("Command to execute in the container"),
  });

  metadata = { category: "docker" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { container, command } = input;

    const args = ['exec', container, ...command.split(' ')];

    try {
      const res = await runCommand('docker', args, { timeoutMs: 60000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing docker exec: ${(error as Error).message}`;
    }
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('docker_exec', async () => new DockerExecTool(), 'docker');
