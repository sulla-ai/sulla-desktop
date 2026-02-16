import { BaseTool, ToolRegistration } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Docker Pull Tool - Worker class for execution
 */
export class DockerPullWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
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

// Export the complete tool registration with type enforcement
export const dockerPullRegistration: ToolRegistration = {
  name: "docker_pull",
  description: "Pull a Docker image from a registry.",
  category: "docker",
  schemaDef: {
    image: { type: 'string' as const, description: "Docker image to pull" },
  },
  workerClass: DockerPullWorker,
};
