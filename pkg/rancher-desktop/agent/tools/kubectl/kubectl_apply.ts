import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Kubectl Apply Tool - Worker class for execution
 */
export class KubectlApplyWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { file, namespace, dryRun } = input;

    const args = ['apply', '-f', file];

    if (namespace) {
      args.push('-n', namespace);
    }

    if (dryRun && dryRun !== 'none') {
      args.push('--dry-run', dryRun);
    }

    try {
      const res = await runCommand('kubectl', args, { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return {
          successBoolean: false,
          responseString: `Error applying manifest: ${res.stderr || res.stdout}`
        };
      }

      const responseString = `Applied manifest from ${file}${namespace ? ` in namespace ${namespace}` : ''}${dryRun && dryRun !== 'none' ? ` (dry-run: ${dryRun})` : ''}\nOutput:\n${res.stdout}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error executing kubectl apply: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const kubectlApplyRegistration: ToolRegistration = {
  name: "kubectl_apply",
  description: "Apply a Kubernetes manifest file.",
  category: "kubectl",
  schemaDef: {
    file: { type: 'string' as const, description: "Path to the manifest file" },
    namespace: { type: 'string' as const, optional: true, description: "Namespace to apply to" },
    dryRun: { type: 'string' as const, optional: true, description: "Dry run mode: client, server, or none" },
  },
  workerClass: KubectlApplyWorker,
};
