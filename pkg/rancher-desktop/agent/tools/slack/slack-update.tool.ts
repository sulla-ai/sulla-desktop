import { BaseTool } from "../base";
import { z } from "zod";
import { registry } from "../../integrations";
import type { SlackClient } from "../../integrations/slack/SlackClient";

export class SlackUpdateTool extends BaseTool {
  name = "slack_update";
  description = "Update an existing Slack message.";
  schema = z.object({
    channel: z.string().describe("Channel ID where the message is"),
    ts: z.string().describe("Timestamp of the message to update"),
    text: z.string().describe("New message text"),
  });

  metadata = { category: "slack" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { channel, ts, text } = input;

    try {
      const slack = await registry.get<SlackClient>('slack');
      const res = await slack.updateMessage(channel, ts, text);
      return { ok: res.ok };
    } catch (error) {
      return `Error updating Slack message: ${(error as Error).message}`;
    }
  }
}
