import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { Octokit } from "@octokit/rest";
import { getIntegrationService } from '../../services/IntegrationService';

/**
 * GitHub Create File Tool - Worker class for execution
 */
export class GitHubCreateFileWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { owner, repo, path, content, message, branch } = input;

    const integrationService = getIntegrationService();
    const tokenValue = await integrationService.getIntegrationValue('github', 'token');
    if (!tokenValue) {
      return {
        successBoolean: false,
        responseString: "Error: GitHub token not configured."
      };
    }

    const octokit = new Octokit({ auth: tokenValue.value });

    try {
      const response = await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content).toString('base64'),
        branch,
      });

      const responseString = `File created successfully:
Repository: ${owner}/${repo}
Path: ${path}
Branch: ${branch || 'default'}
Commit SHA: ${response.data.commit.sha}
Commit URL: ${response.data.commit.html_url}
Content SHA: ${response.data.content?.sha || 'N/A'}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error creating file: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const gitHubCreateFileRegistration: ToolRegistration = {
  name: "github_create_file",
  description: "Create a new file in a GitHub repository.",
  category: "github",
  schemaDef: {
    owner: { type: 'string' as const, description: "Repository owner (username or organization)" },
    repo: { type: 'string' as const, description: "Repository name" },
    path: { type: 'string' as const, description: "Path where the file should be created" },
    content: { type: 'string' as const, description: "Content of the file" },
    message: { type: 'string' as const, description: "Commit message" },
    branch: { type: 'string' as const, optional: true, description: "Branch to create the file on" },
  },
  workerClass: GitHubCreateFileWorker,
};
