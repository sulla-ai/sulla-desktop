import { BaseTool } from "../base";
import { z } from "zod";
import { Gitlab } from "@gitbeaker/node";
import { getIntegrationService } from '../../services/IntegrationService';

export class GitLabCreateFileTool extends BaseTool {
  name = "gitlab_create_file";
  description = "Create a new file in a GitLab repository.";
  schema = z.object({
    projectId: z.string().describe("GitLab project ID (numeric or 'owner/repo')"),
    file_path: z.string().describe("Path where the file should be created"),
    branch: z.string().describe("Branch to create the file on"),
    content: z.string().describe("Content of the file"),
    commit_message: z.string().describe("Commit message"),
  });

  metadata = { category: "software_development" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { projectId, file_path, branch, content, commit_message } = input;

    const integrationService = getIntegrationService();
    const tokenValue = await integrationService.getIntegrationValue('gitlab', 'token');
    if (!tokenValue) {
      return "Error: GitLab token not configured.";
    }

    const api = new Gitlab({ token: tokenValue.value });

    try {
      const file = await api.RepositoryFiles.create(projectId, file_path, branch, content, commit_message);

      return {
        file_path: file.file_path,
        branch: file.branch,
        commit_id: file.commit_id,
        size: file.size,
      };
    } catch (error) {
      return `Error creating file: ${(error as Error).message}`;
    }
  }
}
