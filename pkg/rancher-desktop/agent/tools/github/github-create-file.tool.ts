import { BaseTool } from "../base";
import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { getIntegrationService } from '../../services/IntegrationService';

export class GitHubCreateFileTool extends BaseTool {
  name = "github_create_file";
  description = "Create a new file in a GitHub repository.";
  schema = z.object({
    owner: z.string().describe("Repository owner (username or organization)"),
    repo: z.string().describe("Repository name"),
    path: z.string().describe("Path where the file should be created"),
    content: z.string().describe("Content of the file"),
    message: z.string().describe("Commit message"),
    branch: z.string().optional().describe("Branch to create the file on"),
  });

  metadata = { category: "software_development" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { owner, repo, path, content, message, branch } = input;

    const integrationService = getIntegrationService();
    const tokenValue = await integrationService.getIntegrationValue('github', 'token');
    if (!tokenValue) {
      return "Error: GitHub token not configured.";
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

      return {
        commit: response.data.commit,
        content: response.data.content,
      };
    } catch (error) {
      return `Error creating file: ${(error as Error).message}`;
    }
  }
}
