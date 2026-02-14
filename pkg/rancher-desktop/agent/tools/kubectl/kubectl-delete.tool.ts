import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class KubectlDeleteTool extends BaseTool {
  name = "kubectl_delete";
  description = "Delete Kubernetes resources.";
  schema = z.object({
    resource: z.string().describe("The resource type, e.g., pods, services"),
    name: z.string().describe("Specific resource name"),
    namespace: z.string().optional().describe("Namespace"),
    force: z.boolean().optional().describe("Force deletion"),
    gracePeriod: z.number().optional().describe("Seconds to wait before force killing the pod"),
  });

  metadata = { category: "kubectl" };

  protected async _call(input: z.infer<this["schema"]>) {
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
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing kubectl delete: ${(error as Error).message}`;
    }
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('kubectl_delete', async () => new KubectlDeleteTool(), 'kubernetes');
