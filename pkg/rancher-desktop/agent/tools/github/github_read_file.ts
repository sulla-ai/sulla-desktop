import { BaseTool, ToolRegistration } from "../base";
import { Octokit } from "@octokit/rest";
import { getIntegrationService } from '../../services/IntegrationService';

/**
 * GitHub Read File Tool - Worker class for execution
 */
export class GitHubReadFileWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { owner, repo, path, ref } = input;

    const integrationService = getIntegrationService();
    const tokenValue = await integrationService.getIntegrationValue('github', 'token');
    if (!tokenValue) {
      return "Error: GitHub token not configured.";
    }

    const octokit = new Octokit({ auth: tokenValue.value });

    try {
      const response = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      const data = response.data;
      if (Array.isArray(data)) {
        return `Path '${path}' is a directory, not a file.`;
      }

      if (data.type !== 'file') {
        return `Path '${path}' is not a file.`;
      }

      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return {
        path: data.path,
        content,
        encoding: data.encoding,
        size: data.size,
        sha: data.sha,
      };
    } catch (error) {
      return `Error reading file: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const gitHubReadFileRegistration: ToolRegistration = {
  name: "github_read_file",
  description: "Read the contents of a file from a GitHub repository.",
  category: "github",
  schemaDef: {
    owner: { type: 'string' as const, description: "Repository owner (username or organization)" },
    repo: { type: 'string' as const, description: "Repository name" },
    path: { type: 'string' as const, description: "Path to the file in the repository" },
    ref: { type: 'string' as const, optional: true, description: "Branch, tag, or commit SHA" },
  },
  workerClass: GitHubReadFileWorker,
};
