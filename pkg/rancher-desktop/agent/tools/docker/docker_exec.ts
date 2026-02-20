import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Docker Exec Tool - Worker class for execution
 */
export class DockerExecWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  private buildExecArgs(container: string, command: string): string[] {
    // Route through container shell so quoted values / spaces are preserved.
    return ['exec', container, 'sh', '-lc', command];
  }

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { container, command } = input;

    const args = this.buildExecArgs(container, command);

    try {
      const res = await runCommand('docker', args, { timeoutMs: 60000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return {
          successBoolean: false,
          responseString: `Error executing command in container ${container}: ${res.stderr || res.stdout}`
        };
      }

      return {
        successBoolean: true,
        responseString: `Command executed in container ${container}: ${command}\nOutput:\n${res.stdout}`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing docker exec: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const dockerExecRegistration: ToolRegistration = {
  name: "docker_exec",
  description: "Execute a command in a running Docker container.",
  category: "docker",
  schemaDef: {
    container: { type: 'string' as const, description: "Container name or ID" },
    command: { type: 'string' as const, description: "Command to execute in the container" },
  },
  workerClass: DockerExecWorker,
};
