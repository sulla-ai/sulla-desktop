import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class KubectlExecTool extends BaseTool {
  name = "kubectl_exec";
  description = "Execute a command in a Kubernetes pod.";
  schema = z.object({
    podName: z.string().describe("The name of the pod"),
    command: z.string().describe("The command to execute"),
    namespace: z.string().optional().describe("Namespace"),
    container: z.string().optional().describe("Container name if multi-container pod"),
  });

  metadata = { category: "kubectl" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { podName, command, namespace, container } = input;

    const args = ['exec', podName, '--'];

    // Split command into args if it's a string
    const cmdArgs = command.split(' ');
    args.push(...cmdArgs);

    if (namespace) {
      args.splice(2, 0, '-n', namespace); // insert before --
    }

    if (container) {
      args.splice(2, 0, '--container', container); // insert before --
    }

    try {
      const res = await runCommand('kubectl', args, { timeoutMs: 60_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing kubectl exec: ${(error as Error).message}`;
    }
  }
}
