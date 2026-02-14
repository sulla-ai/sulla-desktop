import { BaseTool } from "../base";
import { z } from "zod";
import { Gitlab } from "@gitbeaker/node";
import { getIntegrationService } from '../../services/IntegrationService';

export class GitLabCommentOnIssueTool extends BaseTool {
  name = "gitlab_comment_on_issue";
  description = "Add a comment to a GitLab issue.";
  schema = z.object({
    projectId: z.string().describe("GitLab project ID (numeric or 'owner/repo')"),
    issue_iid: z.number().describe("Issue internal ID"),
    body: z.string().describe("Comment body"),
  });

  metadata = { category: "software_development" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { projectId, issue_iid, body } = input;

    const integrationService = getIntegrationService();
    const tokenValue = await integrationService.getIntegrationValue('gitlab', 'token');
    if (!tokenValue) {
      return "Error: GitLab token not configured.";
    }

    const api = new Gitlab({ token: tokenValue.value });

    try {
      const note = await api.IssueNotes.create(projectId, issue_iid, body);

      return {
        id: note.id,
        body: note.body,
        author: note.author?.username,
        created_at: note.created_at,
      };
    } catch (error) {
      return `Error commenting on issue: ${(error as Error).message}`;
    }
  }
}
