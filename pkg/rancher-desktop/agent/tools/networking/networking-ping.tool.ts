import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class NetworkingPingTool extends BaseTool {
  name = "networking_ping";
  description = "Send ICMP ECHO_REQUEST packets to network hosts.";
  schema = z.object({
    host: z.string().describe("Host to ping"),
    count: z.number().optional().describe("Number of packets to send (default: 4)"),
    options: z.string().optional().describe("Additional ping options"),
  });

  metadata = { category: "networking" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { host, count, options } = input;

    const args = [];
    if (count !== undefined) {
      args.push('-c', count.toString());
    }
    if (options) {
      args.push(...options.split(' '));
    }
    args.push(host);

    try {
      const res = await runCommand('ping', args, { timeoutMs: 30000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0 && res.exitCode !== 1 && res.exitCode !== 2) { // ping returns 1 for no response, 2 for other errors
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing ping: ${(error as Error).message}`;
    }
  }
}
