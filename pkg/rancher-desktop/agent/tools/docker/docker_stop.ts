import { BaseTool, ToolRegistration } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Docker Stop Tool - Worker class for execution
 */
export class DockerStopWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
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

// Export the complete tool registration with type enforcement
export const dockerStopRegistration: ToolRegistration = {
  name: "docker_stop",
  description: "Stop a running Docker container.",
  category: "docker",
  schemaDef: {
    container: { type: 'string' as const, description: "Container name or ID to stop" },
  },
  workerClass: DockerStopWorker,
};
