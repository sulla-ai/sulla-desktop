import { BaseTool } from "../base";
import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { getIntegrationService } from '../../services/IntegrationService';

export class GitHubListBranchesTool extends BaseTool {
  name = "github_list_branches";
  description = "List branches in a GitHub repository.";
  schema = z.object({
    owner: z.string().describe("Repository owner (username or organization)"),
    repo: z.string().describe("Repository name"),
    protected: z.boolean().optional().describe("Filter for protected branches only"),
  });

  metadata = { category: "software_development" };

  protected async _call(input: z.infer<this["schema"]>) {
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
