import { BaseTool, ToolRegistration } from "../base";
import { Octokit } from "@octokit/rest";
import { getIntegrationService } from '../../services/IntegrationService';

/**
 * GitHub Get Issues Tool - Worker class for execution
 */
export class GitHubGetIssuesWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { owner, repo, state = 'open', labels, since, limit = 10 } = input;

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

// Export the complete tool registration with type enforcement
export const gitHubGetIssuesRegistration: ToolRegistration = {
  name: "github_get_issues",
  description: "Get issues from a GitHub repository.",
  category: "github",
  schemaDef: {
    owner: { type: 'string' as const, description: "Repository owner (username or organization)" },
    repo: { type: 'string' as const, description: "Repository name" },
    state: { type: 'enum' as const, enum: ['open', 'closed', 'all'], default: 'open', description: "Issue state filter" },
    labels: { type: 'array' as const, items: { type: 'string' as const }, optional: true, description: "Labels to filter issues" },
    since: { type: 'string' as const, optional: true, description: "Only issues updated after this ISO 8601 timestamp" },
    limit: { type: 'number' as const, optional: true, default: 10, description: "Maximum number of issues to return" },
  },
  workerClass: GitHubGetIssuesWorker,
};
