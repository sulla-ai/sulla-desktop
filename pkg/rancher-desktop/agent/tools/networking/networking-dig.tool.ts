import { BaseTool } from "../base";
import { z } from "zod";
import { runCommand } from "../util/CommandRunner";

export class NetworkingDigTool extends BaseTool {
  name = "networking_dig";
  description = "DNS lookup utility.";
  schema = z.object({
    domain: z.string().describe("Domain name to query"),
    type: z.string().optional().describe("Query type (A, MX, CNAME, etc.)"),
    options: z.string().optional().describe("Additional dig options"),
  });

  metadata = { category: "networking" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { domain, type, options } = input;

    const args = [];
    if (options) {
      args.push(...options.split(' '));
    }
    args.push(domain);
    if (type) {
      args.push(type);
    }

    try {
      const res = await runCommand('dig', args, { timeoutMs: 30000, maxOutputChars: 160_000 });

      if (res.exitCode !== 0) {
        return `Error: ${res.stderr || res.stdout}`;
      }

      return res.stdout;
    } catch (error) {
      return `Error executing dig: ${(error as Error).message}`;
    }
  }
}
