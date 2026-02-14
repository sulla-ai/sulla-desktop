import { BaseTool } from "../base";
import { z } from "zod";
import { Gitlab } from "@gitbeaker/node";
import { getIntegrationService } from '../../services/IntegrationService';

export class GitLabGetIssuesTool extends BaseTool {
  name = "gitlab_get_issues";
  description = "Get issues from a GitLab project.";
  schema = z.object({
    projectId: z.string().describe("GitLab project ID (numeric or 'owner/repo')"),
    state: z.enum(['opened', 'closed', 'all']).optional().default('opened').describe("Issue state filter"),
    labels: z.array(z.string()).optional().describe("Labels to filter issues"),
    created_after: z.string().optional().describe("Only issues created after this ISO 8601 timestamp"),
    per_page: z.number().optional().default(10).describe("Number of issues per page"),
  });

  metadata = { category: "software_development" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { projectId, state, labels, created_after, per_page } = input;

    const integrationService = getIntegrationService();
    const tokenValue = await integrationService.getIntegrationValue('gitlab', 'token');
    if (!tokenValue) {
      return "Error: GitLab token not configured.";
    }

    const api = new Gitlab({ token: tokenValue.value });

    try {
      const issues = await api.Issues.all({
        projectId,
        state,
        labels: labels?.join(','),
        created_after,
        perPage: per_page,
      });

      return issues.map(issue => ({
        iid: issue.iid,
        title: issue.title,
        state: issue.state,
        author: (issue.author as { username: string })?.username,
        labels: issue.labels,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        description: issue.description,
      }));
    } catch (error) {
      return `Error getting issues: ${(error as Error).message}`;
    }
  }
}
