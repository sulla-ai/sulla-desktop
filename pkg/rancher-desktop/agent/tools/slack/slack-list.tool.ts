import { BaseTool } from "../base";
import { z } from "zod";
import { registry } from "../../integrations";
import type { SlackClient } from "../../integrations/slack/SlackClient";

export class SlackListTool extends BaseTool {
  name = "slack_list";
  description = "List Slack channels.";
  schema = z.object({});

  metadata = { category: "slack" };

  protected async _call(input: z.infer<this["schema"]>) {
    try {
      const slack = await registry.get<SlackClient>('slack');
      const channels = await slack.listChannels();
      return channels.map((c: any) => ({ id: c.id, name: c.name, is_member: c.is_member }));
    } catch (error) {
      return `Error listing Slack channels: ${(error as Error).message}`;
    }
  }
}
