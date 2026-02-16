import { BaseTool, ToolRegistration } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Docker Build Tool - Worker class for execution
 */
export class DockerBuildWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { path, tag, options } = input;

    const args = ['build'];
    if (options) {
      args.push(...options.split(' '));
    }
    args.push('-t', tag, path);

    try {
      const res = await runCommand('docker', args, { timeoutMs: 300000, maxOutputChars: 160_000 }); // Longer timeout for building

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing docker build: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const dockerBuildRegistration: ToolRegistration = {
  name: "docker_build",
  description: "Build a Docker image from a Dockerfile.",
  category: "docker",
  schemaDef: {
    path: { type: 'string' as const, description: "Path to the directory containing the Dockerfile" },
    tag: { type: 'string' as const, description: "Tag for the built image" },
    options: { type: 'string' as const, optional: true, description: "Additional docker build options" },
  },
  workerClass: DockerBuildWorker,
};
