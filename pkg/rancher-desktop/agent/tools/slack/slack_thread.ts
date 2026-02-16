import { BaseTool, ToolRegistration } from "../base";
import { registry } from "../../integrations";
import type { SlackClient } from "../../integrations/slack/SlackClient";

/**
 * Slack Thread Tool - Worker class for execution
 */
export class SlackThreadWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { channel, ts } = input;

    try {
      const slack = await registry.get<SlackClient>('slack');
      const replies = await slack.getThreadReplies(channel, ts);
      return replies;
    } catch (error) {
      return `Error getting Slack thread: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const slackThreadRegistration: ToolRegistration = {
  name: "slack_thread",
  description: "Get replies in a Slack thread.",
  category: "slack",
  schemaDef: {
    channel: { type: 'string' as const, description: "Channel ID where the thread is" },
    ts: { type: 'string' as const, description: "Timestamp of the parent message" },
  },
  workerClass: SlackThreadWorker,
};
