import { BaseTool } from "../base";
import { z } from "zod";
import { registry } from "../../integrations";
import type { SlackClient } from "../../integrations/slack/SlackClient";

export class SlackReactTool extends BaseTool {
  name = "slack_react";
  description = "Add a reaction emoji to a Slack message.";
  schema = z.object({
    channel: z.string().describe("Channel ID where the message is"),
    ts: z.string().describe("Timestamp of the message"),
    reaction: z.string().describe("Reaction emoji name (without colons)"),
  });

  metadata = { category: "slack" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { channel, ts, reaction } = input;

    try {
      const slack = await registry.get<SlackClient>('slack');
      await slack.addReaction(channel, ts, reaction);
      return { added: reaction };
    } catch (error) {
      return `Error adding Slack reaction: ${(error as Error).message}`;
    }
  }
}
