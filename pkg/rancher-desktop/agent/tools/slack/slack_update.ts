import { BaseTool, ToolRegistration } from "../base";
import { registry } from "../../integrations";
import type { SlackClient } from "../../integrations/slack/SlackClient";

/**
 * Slack Update Tool - Worker class for execution
 */
export class SlackUpdateWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
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

// Export the complete tool registration with type enforcement
export const slackUpdateRegistration: ToolRegistration = {
  name: "slack_update",
  description: "Update an existing Slack message.",
  category: "slack",
  schemaDef: {
    channel: { type: 'string' as const, description: "Channel ID where the message is" },
    ts: { type: 'string' as const, description: "Timestamp of the message to update" },
    text: { type: 'string' as const, description: "New message text" },
  },
  workerClass: SlackUpdateWorker,
};
