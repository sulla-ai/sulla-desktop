import { BaseTool, ToolRegistration } from "../base";
import { runCommand } from "../util/CommandRunner";

/**
 * Rdctl Snapshot Tool - Worker class for execution
 */
export class RdctlSnapshotWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { subcommand, args = [] } = input;

    const cmdArgs = ['snapshot', subcommand, ...args];

    try {
      const res = await runCommand('rdctl', cmdArgs, { timeoutMs: 120_000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing rdctl snapshot: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const rdctlSnapshotRegistration: ToolRegistration = {
  name: "rdctl_snapshot",
  description: "Manage Sulla Desktop snapshots.",
  category: "rdctl",
  schemaDef: {
    subcommand: { type: 'string' as const, description: "Snapshot subcommand, e.g., list, create, delete" },
    args: { type: 'array' as const, items: { type: 'string' as const }, optional: true, description: "Arguments for the subcommand" },
  },
  workerClass: RdctlSnapshotWorker,
};
