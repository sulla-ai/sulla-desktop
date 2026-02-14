import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class KubectlLogsTool extends BaseTool {
  name = "kubectl_logs";
  description = "Get logs from a Kubernetes pod.";
  schema = z.object({
    podName: z.string().describe("The name of the pod"),
    namespace: z.string().optional().describe("Namespace"),
    container: z.string().optional().describe("Container name if multi-container pod"),
    follow: z.boolean().optional().describe("Follow log output"),
    previous: z.boolean().optional().describe("Return logs from previous container instance"),
    tail: z.number().optional().describe("Number of lines to show from the end of the logs"),
  });

  metadata = { category: "kubectl" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { podName, namespace, container, follow, previous, tail } = input;

    const args = ['logs', podName];

    if (namespace) {
      args.push('-n', namespace);
    }

    if (container) {
      args.push('--container', container);
    }

    if (follow) {
      args.push('-f');
    }

    if (previous) {
      args.push('--previous');
    }

    if (tail !== undefined) {
      args.push('--tail', tail.toString());
    }

    try {
      const res = await runCommand('kubectl', args, { timeoutMs: follow ? 300_000 : 60_000, maxOutputChars: follow ? 320_000 : 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing kubectl logs: ${(error as Error).message}`;
    }
  }
}
