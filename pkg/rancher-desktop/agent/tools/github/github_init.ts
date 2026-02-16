import { BaseTool, ToolRegistration } from "../base";
import { execSync } from 'child_process';
import path from 'path';

/**
 * GitHub Init Tool - Worker class for execution
 */
export class GitHubInitWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any) {
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
        success: true,
        message: `Git repository initialized successfully at ${absolutePath}`,
        path: absolutePath
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to initialize git repository: ${error.message}`,
        path: absolutePath
      };
    }
  }
}

// Register the tool statically
export const gitHubInitRegistration: ToolRegistration = {
  name: "github_init",
  description: "Initialize a git repository at the specified absolute path.",
  category: "github",
  schemaDef: {
    absolutePath: { type: 'string' as const, description: "Absolute path where the git repository should be initialized" },
  },
  workerClass: GitHubInitWorker,
};
