import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class DockerLogsTool extends BaseTool {
  name = "docker_logs";
  description = "Fetch the logs of a Docker container.";
  schema = z.object({
    container: z.string().describe("Container name or ID"),
    follow: z.boolean().optional().describe("Follow log output"),
    tail: z.number().optional().describe("Number of lines to show from the end"),
  });

  metadata = { category: "docker" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { container, follow, tail } = input;

    const args = ['logs', container];
    if (follow) {
      args.push('-f');
    }
    if (tail !== undefined) {
      args.push('--tail', tail.toString());
    }

    try {
      const res = await runCommand('docker', args, { timeoutMs: follow ? 300000 : 30000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing docker logs: ${(error as Error).message}`;
    }
  }
}
