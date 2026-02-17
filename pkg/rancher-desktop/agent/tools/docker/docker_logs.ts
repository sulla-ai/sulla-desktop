import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Docker Logs Tool - Worker class for execution
 */
export class DockerLogsWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
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
        return {
          successBoolean: false,
          responseString: `Error fetching logs for container ${container}: ${res.stderr || res.stdout}`
        };
      }

      return {
        successBoolean: true,
        responseString: `Logs for container ${container}${follow ? ' (following)' : ''}${tail ? ` (last ${tail} lines)` : ''}:\n${res.stdout}`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing docker logs: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const dockerLogsRegistration: ToolRegistration = {
  name: "docker_logs",
  description: "Fetch the logs of a Docker container.",
  category: "docker",
  schemaDef: {
    container: { type: 'string' as const, description: "Container name or ID" },
    follow: { type: 'boolean' as const, optional: true, description: "Follow log output" },
    tail: { type: 'number' as const, optional: true, description: "Number of lines to show from the end" },
  },
  workerClass: DockerLogsWorker,
};
