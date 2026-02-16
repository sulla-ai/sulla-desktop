import { BaseTool, ToolRegistration } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Docker Exec Tool - Worker class for execution
 */
export class DockerExecWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
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
