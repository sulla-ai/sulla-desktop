import { BaseTool } from "../base";
import { z } from "zod";
import { registry } from "../../integrations";
import type { SlackClient } from "../../integrations/slack/SlackClient";

export class SlackUserTool extends BaseTool {
  name = "slack_user";
  description = "Get information about a Slack user.";
  schema = z.object({
    userId: z.string().describe("User ID to get info for"),
  });

  metadata = { category: "slack" };

  protected async _call(input: z.infer<this["schema"]>) {
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
