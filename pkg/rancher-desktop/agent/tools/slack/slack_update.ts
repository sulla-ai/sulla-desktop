import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { registry } from "../../integrations";
import type { SlackClient } from "../../integrations/slack/SlackClient";

/**
 * Slack Update Tool - Worker class for execution
 */
export class SlackUpdateWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { channel, ts, text } = input;

    try {
      const slack = await registry.get<SlackClient>('slack');
      if (!slack) {
        return {
          successBoolean: false,
          responseString: `Slack integration is not initialized for command ${this.name}`,
        };
      }
      const res = await slack.updateMessage(channel, ts, text);
      if (res.ok) {
        return {
          successBoolean: true,
          responseString: `Slack message updated successfully in channel ${channel} at timestamp ${ts}`
        };
      } else {
        return {
          successBoolean: false,
          responseString: `Failed to update Slack message: ${res.error || 'Unknown error'}`
        };
      }
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error updating Slack message: ${(error as Error).message}`
      };
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
