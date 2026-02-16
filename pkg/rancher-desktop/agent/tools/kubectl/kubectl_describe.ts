import { BaseTool, ToolRegistration } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Kubectl Describe Tool - Worker class for execution
 */
export class KubectlDescribeWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { resource, name, namespace } = input;

    const args = ['describe', resource, name];

    if (namespace) {
      args.push('-n', namespace);
    }

    try {
      const res = await runCommand('kubectl', args, { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing kubectl describe: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const kubectlDescribeRegistration: ToolRegistration = {
  name: "kubectl_describe",
  description: "Describe Kubernetes resources.",
  category: "kubectl",
  schemaDef: {
    resource: { type: 'string' as const, description: "The resource type, e.g., pods, services" },
    name: { type: 'string' as const, description: "Specific resource name" },
    namespace: { type: 'string' as const, optional: true, description: "Namespace" },
  },
  workerClass: KubectlDescribeWorker,
};
