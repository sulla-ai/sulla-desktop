import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { registry } from "../../integrations";
import type { SlackClient } from "../../integrations/slack/SlackClient";

/**
 * Slack User Tool - Worker class for execution
 */
export class SlackUserWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { userId } = input;

    try {
      const slack = await registry.get<SlackClient>('slack');
      if (!slack) {
        return {
          successBoolean: false,
          responseString: `Slack integration is not initialized for command ${this.name}`,
        };
      }
      const user = await slack.getUserInfo(userId);
      return {
        successBoolean: true,
        responseString: `Slack user info for ${userId}:\n- ID: ${user.id}\n- Name: ${user.name}\n- Real Name: ${user.real_name || user.profile?.real_name || 'N/A'}`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error getting Slack user info: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const slackUserRegistration: ToolRegistration = {
  name: "slack_user",
  description: "Get information about a Slack user.",
  category: "slack",
  operationTypes: ['read'],
  schemaDef: {
    userId: { type: 'string' as const, description: "User ID to get info for" },
  },
  workerClass: SlackUserWorker,
};
