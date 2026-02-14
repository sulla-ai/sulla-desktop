import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class NetworkingIfconfigTool extends BaseTool {
  name = "networking_ifconfig";
  description = "Configure network interfaces.";
  schema = z.object({
    interface: z.string().optional().describe("Network interface name"),
    options: z.string().optional().describe("Additional ifconfig options"),
  });

  metadata = { category: "networking" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { interface, options } = input;

    const args = [];
    if (options) {
      args.push(...options.split(' '));
    }
    if (interface) {
      args.push(interface);
    }

    try {
      const res = await runCommand('ifconfig', args, { timeoutMs: 30000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing ifconfig: ${(error as Error).message}`;
    }
  }
}
