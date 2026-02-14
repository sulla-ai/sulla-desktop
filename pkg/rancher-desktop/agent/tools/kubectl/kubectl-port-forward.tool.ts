import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class KubectlPortForwardTool extends BaseTool {
  name = "kubectl_port_forward";
  description = "Forward one or more local ports to a pod or service.";
  schema = z.object({
    type: z.enum(['pod', 'service']).describe("The resource type"),
    name: z.string().describe("The resource name"),
    ports: z.string().describe("Port mapping, e.g., '8080:80' or '8080:80 8443:443'"),
    namespace: z.string().optional().describe("Namespace"),
  });

  metadata = { category: "kubectl" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { type, name, ports, namespace } = input;

    const resource = type === 'pod' ? `pod/${name}` : `svc/${name}`;
    const args = ['port-forward', resource, ports];

    if (namespace) {
      args.push('-n', namespace);
    }

    try {
      // Port forwarding is long-running, but for this tool, we'll run it briefly to test
      // In practice, this might need to run in background, but for now, timeout after 10 seconds
      const res = await runCommand('kubectl', args, { timeoutMs: 10_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return `Port forwarding started: ${res.stdout}`;
    } catch (error) {
      return `Error executing kubectl port-forward: ${(error as Error).message}`;
    }
  }
}
