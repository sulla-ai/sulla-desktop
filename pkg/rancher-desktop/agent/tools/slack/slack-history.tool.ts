import { BaseTool } from "../base";
import { z } from "zod";
import { registry } from "../../integrations";
import type { SlackClient } from "../../integrations/slack/SlackClient";

export class SlackHistoryTool extends BaseTool {
  name = "slack_history";
  description = "Get the message history of a Slack channel.";
  schema = z.object({
    channel: z.string().describe("Channel ID to get history from"),
    limit: z.number().optional().describe("Number of messages to retrieve (default 10)"),
  });

  metadata = { category: "slack" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { channel, limit = 10 } = input;

    try {
      const slack = await registry.get<SlackClient>('slack');
      const msgs = await slack.getChannelHistory(channel, limit);
      return { count: msgs.length };
    } catch (error) {
      return `Error getting Slack channel history: ${(error as Error).message}`;
    }
  }
}
