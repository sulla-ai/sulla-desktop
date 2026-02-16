import { BaseTool, ToolRegistration } from "../base";
import { registry } from "../../integrations";
import type { SlackClient } from "../../integrations/slack/SlackClient";

/**
 * Slack User Tool - Worker class for execution
 */
export class SlackUserWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any) {
    const { userId } = input;

    try {
      const slack = await registry.get<SlackClient>('slack');
      const user = await slack.getUserInfo(userId);
      return {
        id: user.id,
        name: user.name,
        real_name: user.real_name || user.profile?.real_name
      };
    } catch (error) {
      return `Error getting Slack user info: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const slackUserRegistration: ToolRegistration = {
  name: "slack_user",
  description: "Get information about a Slack user.",
  category: "slack",
  schemaDef: {
    userId: { type: 'string' as const, description: "User ID to get info for" },
  },
  workerClass: SlackUserWorker,
};
