import { BaseTool } from "../base";
import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { getIntegrationService } from '../../services/IntegrationService';

export class GitHubGetIssuesTool extends BaseTool {
  name = "github_get_issues";
  description = "Get issues from a GitHub repository.";
  schema = z.object({
    owner: z.string().describe("Repository owner (username or organization)"),
    repo: z.string().describe("Repository name"),
    state: z.enum(['open', 'closed', 'all']).optional().default('open').describe("Issue state filter"),
    labels: z.array(z.string()).optional().describe("Labels to filter issues"),
    since: z.string().optional().describe("Only issues updated after this ISO 8601 timestamp"),
    limit: z.number().optional().default(10).describe("Maximum number of issues to return"),
  });

  metadata = { category: "software_development" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { owner, repo, state, labels, since, limit } = input;

    const integrationService = getIntegrationService();
    const tokenValue = await integrationService.getIntegrationValue('github', 'token');
    if (!tokenValue) {
      return "Error: GitHub token not configured.";
    }

    const octokit = new Octokit({ auth: tokenValue.value });

    try {
      const response = await octokit.issues.listForRepo({
        owner,
        repo,
        state,
        labels: labels?.join(','),
        since,
        per_page: limit,
      });

      return response.data.map(issue => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        user: issue.user?.login,
        labels: issue.labels.map((label: any) => label.name || label),
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        body: issue.body,
      }));
    } catch (error) {
      return `Error getting issues: ${(error as Error).message}`;
    }
  }
}
