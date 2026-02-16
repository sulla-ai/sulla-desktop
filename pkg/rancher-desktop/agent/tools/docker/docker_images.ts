import { BaseTool, ToolRegistration } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Docker Images Tool - Worker class for execution
 */
export class DockerImagesWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
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

// Export the complete tool registration with type enforcement
export const dockerImagesRegistration: ToolRegistration = {
  name: "docker_images",
  description: "List Docker images.",
  category: "docker",
  schemaDef: {
    all: { type: 'boolean' as const, optional: true, description: "Show all images (default: only top-level images)" },
  },
  workerClass: DockerImagesWorker,
};
