import { BaseTool } from "../base";
import { z } from "zod";
import { registry } from "../../integrations";
import type { SlackClient } from "../../integrations/slack/SlackClient";

export class SlackThreadTool extends BaseTool {
  name = "slack_thread";
  description = "Get replies in a Slack thread.";
  schema = z.object({
    channel: z.string().describe("Channel ID where the thread is"),
    ts: z.string().describe("Timestamp of the parent message"),
  });

  metadata = { category: "slack" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { channel, ts } = input;

    try {
      const slack = await registry.get<SlackClient>('slack');
      const replies = await slack.getThreadReplies(channel, ts);
      return { count: replies.length };
    } catch (error) {
      return `Error getting Slack thread replies: ${(error as Error).message}`;
    }
  }
}
