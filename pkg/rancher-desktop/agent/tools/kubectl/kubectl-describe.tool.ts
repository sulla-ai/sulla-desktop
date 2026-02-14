import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class KubectlDescribeTool extends BaseTool {
  name = "kubectl_describe";
  description = "Describe Kubernetes resources.";
  schema = z.object({
    resource: z.string().describe("The resource type, e.g., pods, services"),
    name: z.string().describe("Specific resource name"),
    namespace: z.string().optional().describe("Namespace"),
  });

  metadata = { category: "kubectl" };

  protected async _call(input: z.infer<this["schema"]>) {
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

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('kubectl_describe', async () => new KubectlDescribeTool(), 'kubernetes');
