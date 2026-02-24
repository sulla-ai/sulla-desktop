import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Kubectl Delete Tool - Worker class for execution
 */
export class KubectlDeleteWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { resource, name, namespace, force, gracePeriod } = input;

    const args = ['delete', resource, name];

    if (namespace) {
      args.push('-n', namespace);
    }

    if (force) {
      args.push('--force');
    }

    if (gracePeriod !== undefined) {
      args.push('--grace-period', gracePeriod.toString());
    }

    try {
      const res = await runCommand('kubectl', args, { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return {
          successBoolean: false,
          responseString: `Error deleting resource: ${res.stderr || res.stdout}`
        };
      }

      const responseString = `Deleted ${resource} ${name}${namespace ? ` in namespace ${namespace}` : ''}${force ? ' (force)' : ''}${gracePeriod !== undefined ? ` (grace period: ${gracePeriod}s)` : ''}\nOutput:\n${res.stdout}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing kubectl delete: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const kubectlDeleteRegistration: ToolRegistration = {
  name: "kubectl_delete",
  description: "Delete Kubernetes resources.",
  category: "kubectl",
  operationTypes: ['delete'],
  schemaDef: {
    resource: { type: 'string' as const, description: "The resource type, e.g., pods, services" },
    name: { type: 'string' as const, description: "Specific resource name" },
    namespace: { type: 'string' as const, optional: true, description: "Namespace" },
    force: { type: 'boolean' as const, optional: true, description: "Force deletion" },
    gracePeriod: { type: 'number' as const, optional: true, description: "Seconds to wait before force killing the pod" },
  },
  workerClass: KubectlDeleteWorker,
};
