import { BaseTool, ToolRegistration } from "../base";
import { Octokit } from "@octokit/rest";
import { getIntegrationService } from '../../services/IntegrationService';
/**
 * GitHub Comment on Issue Tool - Worker class for execution
 */
class GitHubCommentOnIssueWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any) {
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

// Register the tool statically
export const gitHubCommentOnIssueRegistration: ToolRegistration = {
  name: "github_comment_on_issue",
  description: "Add a comment to a GitHub issue.",
  category: "github",
  schemaDef: {
    owner: { type: 'string' as const, description: "Repository owner (username or organization)" },
    repo: { type: 'string' as const, description: "Repository name" },
    issue_number: { type: 'number' as const, description: "Issue number" },
    body: { type: 'string' as const, description: "Comment body" },
  },
  workerClass: GitHubCommentOnIssueWorker,
};
