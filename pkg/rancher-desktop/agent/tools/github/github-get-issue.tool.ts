import { BaseTool } from "../base";
import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { getIntegrationService } from '../../services/IntegrationService';

export class GitHubGetIssueTool extends BaseTool {
  name = "github_get_issue";
  description = "Get details of a specific GitHub issue.";
  schema = z.object({
    owner: z.string().describe("Repository owner (username or organization)"),
    repo: z.string().describe("Repository name"),
    issue_number: z.number().describe("Issue number"),
  });

  metadata = { category: "software_development" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { owner, repo, issue_number } = input;

    const integrationService = getIntegrationService();
    const tokenValue = await integrationService.getIntegrationValue('github', 'token');
    if (!tokenValue) {
      return "Error: GitHub token not configured.";
    }

    const octokit = new Octokit({ auth: tokenValue.value });

    try {
      const response = await octokit.issues.get({
        owner,
        repo,
        issue_number,
      });

      const issue = response.data;
      return {
        number: issue.number,
        title: issue.title,
        state: issue.state,
        user: issue.user?.login,
        labels: issue.labels.map((label: any) => label.name || label),
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        closed_at: issue.closed_at,
        body: issue.body,
        comments: issue.comments,
        assignees: issue.assignees?.map(a => a.login),
      };
    } catch (error) {
      return `Error getting issue: ${(error as Error).message}`;
    }
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('github_get_issue', async () => new GitHubGetIssueTool(), 'software_development');
