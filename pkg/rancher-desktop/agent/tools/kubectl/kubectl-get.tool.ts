import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class KubectlGetTool extends BaseTool {
  name = "kubectl_get";
  description = "Get Kubernetes resources.";
  schema = z.object({
    resource: z.string().describe("The resource type, e.g., pods, services"),
    name: z.string().optional().describe("Specific resource name"),
    namespace: z.string().optional().describe("Namespace"),
    selector: z.string().optional().describe("Label selector"),
    output: z.string().optional().describe("Output format, e.g., wide, yaml, json"),
  });

  metadata = { category: "kubectl" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { resource, name, namespace, selector, output } = input;

    const args = ['get', resource];

    if (name) {
      args.push(name);
    }

    if (namespace) {
      args.push('-n', namespace);
    }

    if (selector) {
      args.push('-l', selector);
    }

    if (output) {
      args.push('-o', output);
    }

    try {
      const res = await runCommand('kubectl', args, { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing kubectl get: ${(error as Error).message}`;
    }
  }
}
