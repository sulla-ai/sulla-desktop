import { BaseTool } from "../base";
import { z } from "zod";
import { Gitlab } from "@gitbeaker/node";
import { getIntegrationService } from '../../services/IntegrationService';

export class GitLabGetIssueTool extends BaseTool {
  name = "gitlab_get_issue";
  description = "Get details of a specific GitLab issue.";
  schema = z.object({
    projectId: z.string().describe("GitLab project ID (numeric or 'owner/repo')"),
    issue_iid: z.number().describe("Issue internal ID"),
  });

  metadata = { category: "software_development" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { projectId, issue_iid } = input;

    const integrationService = getIntegrationService();
    const tokenValue = await integrationService.getIntegrationValue('gitlab', 'token');
    if (!tokenValue) {
      return "Error: GitLab token not configured.";
    }

    const api = new Gitlab({ token: tokenValue.value });

    try {
      const issue = await api.Issues.show(projectId, issue_iid);

      return {
        iid: issue.iid,
        title: issue.title,
        state: issue.state,
        author: (issue.author as { username: string })?.username,
        assignees: issue.assignees?.map(a => (a as { username: string }).username),
        labels: issue.labels,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        closed_at: issue.closed_at,
        description: issue.description,
      };
    } catch (error) {
      return `Error getting issue: ${(error as Error).message}`;
    }
  }
}
