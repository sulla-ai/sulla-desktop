import { BaseTool, ToolRegistration } from "../base";
import { registry } from "../../integrations";
import type { SlackClient } from "../../integrations/slack/SlackClient";

/**
 * Slack Unreact Tool - Worker class for execution
 */
export class SlackUnreactWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
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

// Export the complete tool registration with type enforcement
export const slackUnreactRegistration: ToolRegistration = {
  name: "slack_unreact",
  description: "Remove a reaction emoji from a Slack message.",
  category: "slack",
  schemaDef: {
    channel: { type: 'string' as const, description: "Channel ID where the message is" },
    ts: { type: 'string' as const, description: "Timestamp of the message" },
    reaction: { type: 'string' as const, description: "Reaction emoji name to remove (without colons)" },
  },
  workerClass: SlackUnreactWorker,
};
