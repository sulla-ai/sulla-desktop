import { BaseTool } from "../base";
import { z } from "zod";
import { registry } from "../../integrations";
import type { SlackClient } from "../../integrations/slack/SlackClient";

export class SlackUnreactTool extends BaseTool {
  name = "slack_unreact";
  description = "Remove a reaction emoji from a Slack message.";
  schema = z.object({
    channel: z.string().describe("Channel ID where the message is"),
    ts: z.string().describe("Timestamp of the message"),
    reaction: z.string().describe("Reaction emoji name to remove (without colons)"),
  });

  metadata = { category: "slack" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { channel, ts, reaction } = input;

    try {
      const slack = await registry.get<SlackClient>('slack');
      await slack.removeReaction(channel, ts, reaction);
      return { removed: reaction };
    } catch (error) {
      return `Error removing Slack reaction: ${(error as Error).message}`;
    }
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('slack_unreact', async () => new SlackUnreactTool(), 'slack');
