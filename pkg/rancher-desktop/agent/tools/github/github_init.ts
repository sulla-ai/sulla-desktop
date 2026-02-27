import { BaseTool, ToolResponse } from "../base";
import { execSync } from 'child_process';
import path from 'path';

/**
 * GitHub Init Tool - Worker class for execution
 */
export class GitHubInitWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { absolutePath } = input;

    try {
      // Change to the absolute path directory and initialize git repo
      execSync(`cd "${absolutePath}" && git init`, {
        stdio: 'pipe',
        env: { ...process.env }
      });

      // Verify git repo was created
      execSync(`cd "${absolutePath}" && git status`, {
        stdio: 'pipe',
        env: { ...process.env }
      });

      return {
        successBoolean: true,
        responseString: `Git repository initialized successfully at ${absolutePath}`
      };
    } catch (error: any) {
      return {
        successBoolean: false,
        responseString: `Failed to initialize git repository at ${absolutePath}: ${error.message}`
      };
    }
  }
}
