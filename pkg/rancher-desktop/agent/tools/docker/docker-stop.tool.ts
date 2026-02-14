import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class DockerStopTool extends BaseTool {
  name = "docker_stop";
  description = "Stop a running Docker container.";
  schema = z.object({
    container: z.string().describe("Container name or ID to stop"),
  });

  metadata = { category: "docker" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { container } = input;

    try {
      const res = await runCommand('docker', ['stop', container], { timeoutMs: 60000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing docker stop: ${(error as Error).message}`;
    }
  }
}
