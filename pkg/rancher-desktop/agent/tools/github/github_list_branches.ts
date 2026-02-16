import { BaseTool, ToolRegistration } from "../base";
import { Octokit } from "@octokit/rest";
import { getIntegrationService } from '../../services/IntegrationService';

/**
 * GitHub List Branches Tool - Worker class for execution
 */
export class GitHubListBranchesWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { owner, repo, protected: isProtected } = input;

    const integrationService = getIntegrationService();
    const tokenValue = await integrationService.getIntegrationValue('github', 'token');
    if (!tokenValue) {
      return "Error: GitHub token not configured.";
    }

    const octokit = new Octokit({ auth: tokenValue.value });

    try {
      const response = await octokit.repos.listBranches({
        owner,
        repo,
        protected: isProtected,
      });

      return response.data.map(branch => ({
        name: branch.name,
        commit: {
          sha: branch.commit.sha,
          url: branch.commit.url,
        },
        protected: branch.protected,
      }));
    } catch (error) {
      return `Error listing branches: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const gitHubListBranchesRegistration: ToolRegistration = {
  name: "github_list_branches",
  description: "List branches in a GitHub repository.",
  category: "github",
  schemaDef: {
    owner: { type: 'string' as const, description: "Repository owner (username or organization)" },
    repo: { type: 'string' as const, description: "Repository name" },
    protected: { type: 'boolean' as const, optional: true, description: "Filter for protected branches only" },
  },
  workerClass: GitHubListBranchesWorker,
};
