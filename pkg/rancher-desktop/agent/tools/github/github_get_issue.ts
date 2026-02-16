import { BaseTool, ToolRegistration } from "../base";
import { Octokit } from "@octokit/rest";
import { getIntegrationService } from '../../services/IntegrationService';

/**
 * GitHub Get Issue Tool - Worker class for execution
 */
export class GitHubGetIssueWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
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

// Export the complete tool registration with type enforcement
export const gitHubGetIssueRegistration: ToolRegistration = {
  name: "github_get_issue",
  description: "Get details of a specific GitHub issue.",
  category: "github",
  schemaDef: {
    owner: { type: 'string' as const, description: "Repository owner (username or organization)" },
    repo: { type: 'string' as const, description: "Repository name" },
    issue_number: { type: 'number' as const, description: "Issue number" },
  },
  workerClass: GitHubGetIssueWorker,
};
