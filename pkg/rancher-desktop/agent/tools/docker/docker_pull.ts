import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Docker Pull Tool - Worker class for execution
 */
export class DockerPullWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { image } = input;

    try {
      const res = await runCommand('docker', ['pull', image], { timeoutMs: 120000, maxOutputChars: 160_000 }); // Longer timeout for pulling

      if (res.exitCode !== 0) {
        return {
          successBoolean: false,
          responseString: `Error pulling docker image: ${res.stderr || res.stdout}`
        };
      }

      return {
        successBoolean: true,
        responseString: `Docker image pulled successfully. Image: ${image}\nPull Output:\n${res.stdout}`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing docker pull: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const dockerPullRegistration: ToolRegistration = {
  name: "docker_pull",
  description: "Pull a Docker image from a registry.",
  category: "docker",
  operationTypes: ['create', 'update'],
  schemaDef: {
    image: { type: 'string' as const, description: "Docker image to pull" },
  },
  workerClass: DockerPullWorker,
};
