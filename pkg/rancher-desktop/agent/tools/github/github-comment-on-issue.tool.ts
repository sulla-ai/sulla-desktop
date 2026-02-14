import { BaseTool } from "../base";
import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { getIntegrationService } from '../../services/IntegrationService';

export class GitHubCommentOnIssueTool extends BaseTool {
  name = "github_comment_on_issue";
  description = "Add a comment to a GitHub issue.";
  schema = z.object({
    owner: z.string().describe("Repository owner (username or organization)"),
    repo: z.string().describe("Repository name"),
    issue_number: z.number().describe("Issue number"),
    body: z.string().describe("Comment body"),
  });

  metadata = { category: "software_development" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { owner, repo, issue_number, body } = input;

    const integrationService = getIntegrationService();
    const tokenValue = await integrationService.getIntegrationValue('github', 'token');
    if (!tokenValue) {
      return "Error: GitHub token not configured.";
    }

    const octokit = new Octokit({ auth: tokenValue.value });

    try {
      const response = await octokit.issues.createComment({
        owner,
        repo,
        issue_number,
        body,
      });

      return {
        id: response.data.id,
        url: response.data.html_url,
        body: response.data.body,
        user: response.data.user?.login,
        created_at: response.data.created_at,
      };
    } catch (error) {
      return `Error commenting on issue: ${(error as Error).message}`;
    }
  }
}
