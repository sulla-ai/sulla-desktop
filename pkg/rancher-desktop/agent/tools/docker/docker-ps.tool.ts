import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class DockerPsTool extends BaseTool {
  name = "docker_ps";
  description = "List Docker containers.";
  schema = z.object({
    all: z.boolean().optional().describe("Show all containers (default: only running)"),
    format: z.string().optional().describe("Format output (e.g., 'table {{.Names}}\\t{{.Status}}')"),
  });

  metadata = { category: "docker" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { all, format } = input;

    const args = ['ps'];
    if (all) {
      args.push('-a');
    }
    if (format) {
      args.push('--format', format);
    }

    try {
      const res = await runCommand('docker', args, { timeoutMs: 30000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing docker ps: ${(error as Error).message}`;
    }
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('docker_ps', async () => new DockerPsTool(), 'docker');
