import { BaseTool } from "../base";
import { z } from "zod";
import { registry } from "../../integrations";
import type { SlackClient } from "../../integrations/slack/SlackClient";

export class SlackJoinTool extends BaseTool {
  name = "slack_join";
  description = "Join a Slack channel.";
  schema = z.object({
    channel: z.string().describe("Channel ID to join"),
  });

  metadata = { category: "slack" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { channel } = input;

    try {
      const slack = await registry.get<SlackClient>('slack');
      await slack.joinChannel(channel);
      return { joined: channel };
    } catch (error) {
      return `Error joining Slack channel: ${(error as Error).message}`;
    }
  }
}
