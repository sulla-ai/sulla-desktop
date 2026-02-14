import { BaseTool } from "../base";
import { z } from "zod";
import { Gitlab } from "@gitbeaker/node";
import { getIntegrationService } from '../../services/IntegrationService';

export class GitLabReadFileTool extends BaseTool {
  name = "gitlab_read_file";
  description = "Read the contents of a file from a GitLab repository.";
  schema = z.object({
    projectId: z.string().describe("GitLab project ID (numeric or 'owner/repo')"),
    file_path: z.string().describe("Path to the file in the repository"),
    ref: z.string().optional().default('main').describe("Branch, tag, or commit SHA"),
  });

  metadata = { category: "software_development" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { projectId, file_path, ref } = input;

    const integrationService = getIntegrationService();
    const tokenValue = await integrationService.getIntegrationValue('gitlab', 'token');
    if (!tokenValue) {
      return "Error: GitLab token not configured.";
    }

    const api = new Gitlab({ token: tokenValue.value });

    try {
      const file = await api.RepositoryFiles.show(projectId, file_path, ref);

      let content = file.content;
      if (file.encoding === 'base64') {
        content = Buffer.from(content, 'base64').toString('utf-8');
      }

      return {
        file_path: file.file_path,
        file_name: file.file_name,
        size: file.size,
        encoding: file.encoding,
        content,
        ref: file.ref,
        blob_id: file.blob_id,
        commit_id: file.commit_id,
        last_commit_id: file.last_commit_id,
      };
    } catch (error) {
      return `Error reading file: ${(error as Error).message}`;
    }
  }
}
