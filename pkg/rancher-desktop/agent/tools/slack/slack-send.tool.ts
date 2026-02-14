import { BaseTool } from "../base";
import { z } from "zod";
import { registry } from "../../integrations";
import type { SlackClient } from "../../integrations/slack/SlackClient";

export class SlackSendTool extends BaseTool {
  name = "slack_send";
  description = "Send a message via Slack bot to a channel or user.";
  schema = z.object({
    channel: z.string().describe("Channel ID or user ID to send to"),
    text: z.string().describe("Message text to send"),
    thread_ts: z.string().optional().describe("Thread timestamp to reply in"),
  });

  metadata = { category: "slack" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { channel, text, thread_ts } = input;

    try {
      const slack = await registry.get<SlackClient>('slack');
      const res = await slack.sendMessage(channel, text, thread_ts);
      return {
        channel: res.channel,
        ts: res.ts,
        text: text.slice(0, 80) + (text.length > 80 ? '...' : '')
      };
    } catch (error) {
      return `Error sending Slack message: ${(error as Error).message}`;
    }
  }
}
