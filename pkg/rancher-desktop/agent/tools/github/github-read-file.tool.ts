import { BaseTool } from "../base";
import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { getIntegrationService } from '../../services/IntegrationService';

export class GitHubReadFileTool extends BaseTool {
  name = "github_read_file";
  description = "Read the contents of a file from a GitHub repository.";
  schema = z.object({
    owner: z.string().describe("Repository owner (username or organization)"),
    repo: z.string().describe("Repository name"),
    path: z.string().describe("Path to the file in the repository"),
    ref: z.string().optional().describe("Branch, tag, or commit SHA"),
  });

  metadata = { category: "software_development" };

  protected async _call(input: z.infer<this["schema"]>) {
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

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('github_read_file', async () => new GitHubReadFileTool(), 'software_development');
