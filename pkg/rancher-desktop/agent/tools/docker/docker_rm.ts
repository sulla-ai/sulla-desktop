import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Docker Rm Tool - Worker class for execution
 */
export class DockerRmWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { container, force } = input;

    const args = ['rm'];
    if (force) {
      args.push('-f');
    }
    args.push(container);

    try {
      const res = await runCommand('docker', args, { timeoutMs: 30000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return {
          successBoolean: false,
          responseString: `Error removing docker container: ${res.stderr || res.stdout}`
        };
      }

      return {
        successBoolean: true,
        responseString: `Container removed successfully. Container: ${container}${force ? ' (force)' : ''}`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing docker rm: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const dockerRmRegistration: ToolRegistration = {
  name: "docker_rm",
  description: "Remove one or more Docker containers.",
  category: "docker",
  schemaDef: {
    container: { type: 'string' as const, description: "Container name or ID to remove" },
    force: { type: 'boolean' as const, optional: true, description: "Force removal of running containers" },
  },
  workerClass: DockerRmWorker,
};
