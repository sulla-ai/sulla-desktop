import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { Octokit } from "@octokit/rest";
import { getIntegrationService } from '../../services/IntegrationService';

/**
 * GitHub Read File Tool - Worker class for execution
 */
export class GitHubReadFileWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { owner, repo, path, ref } = input;

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
      const response = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      const data = response.data;
      if (Array.isArray(data)) {
        return {
          successBoolean: false,
          responseString: `Path '${path}' is a directory, not a file.`
        };
      }

      if (data.type !== 'file') {
        return {
          successBoolean: false,
          responseString: `Path '${path}' is not a file.`
        };
      }

      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      const responseString = `File: ${data.path}
Size: ${data.size} bytes
SHA: ${data.sha}
Encoding: ${data.encoding}
Ref: ${ref || 'default'}

Content:
${content}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error reading file: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const gitHubReadFileRegistration: ToolRegistration = {
  name: "github_read_file",
  description: "Read the contents of a file from a GitHub repository.",
  category: "github",
  operationTypes: ['read'],
  schemaDef: {
    owner: { type: 'string' as const, description: "Repository owner (username or organization)" },
    repo: { type: 'string' as const, description: "Repository name" },
    path: { type: 'string' as const, description: "Path to the file in the repository" },
    ref: { type: 'string' as const, optional: true, description: "Branch, tag, or commit SHA" },
  },
  workerClass: GitHubReadFileWorker,
};
