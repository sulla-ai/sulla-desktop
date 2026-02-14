import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class KubectlApplyTool extends BaseTool {
  name = "kubectl_apply";
  description = "Apply a Kubernetes manifest file.";
  schema = z.object({
    file: z.string().describe("Path to the manifest file"),
    namespace: z.string().optional().describe("Namespace to apply to"),
    dryRun: z.string().optional().describe("Dry run mode: client, server, or none"),
  });

  metadata = { category: "kubectl" };

  protected async _call(input: z.infer<this["schema"]>) {
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
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing kubectl apply: ${(error as Error).message}`;
    }
  }
}
