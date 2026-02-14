import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class DockerRmTool extends BaseTool {
  name = "docker_rm";
  description = "Remove one or more Docker containers.";
  schema = z.object({
    container: z.string().describe("Container name or ID to remove"),
    force: z.boolean().optional().describe("Force removal of running containers"),
  });

  metadata = { category: "docker" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { container, force } = input;

    const args = ['rm'];
    if (force) {
      args.push('-f');
    }
    args.push(container);

    try {
      const res = await runCommand('docker', args, { timeoutMs: 30000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing docker rm: ${(error as Error).message}`;
    }
  }
}
