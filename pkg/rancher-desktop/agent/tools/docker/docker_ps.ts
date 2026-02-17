import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Docker Ps Tool - Worker class for execution
 */
export class DockerPsWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { all, format } = input;

    const args = ['ps'];
    if (all) {
      args.push('-a');
    }
    if (format) {
      args.push('--format', format);
    }

    try {
      const res = await runCommand('docker', args, { timeoutMs: 30000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return {
          successBoolean: false,
          responseString: `Error running docker ps: ${res.stderr || res.stdout}`
        };
      }

      return {
        successBoolean: true,
        responseString: `Docker Containers (${all ? 'All' : 'Running'}):\n${res.stdout}`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing docker ps: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const dockerPsRegistration: ToolRegistration = {
  name: "docker_ps",
  description: "List Docker containers.",
  category: "docker",
  schemaDef: {
    all: { type: 'boolean' as const, optional: true, description: "Show all containers (default: only running)" },
    format: { type: 'string' as const, optional: true, description: "Format output (e.g., 'table {{.Names}}\\t{{.Status}}')" },
  },
  workerClass: DockerPsWorker,
};
