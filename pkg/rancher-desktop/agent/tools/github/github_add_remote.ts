import { BaseTool, ToolRegistration } from "../base";
import { execSync } from 'child_process';

/**
 * GitHub Add Remote Tool - Worker class for execution
 */
export class GitHubAddRemoteWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any) {
    const { absolutePath, remoteName, remoteUrl } = input;

    try {
      // Change to the absolute path directory and add the remote
      execSync(`cd "${absolutePath}" && git remote add ${remoteName} "${remoteUrl}"`, {
        stdio: 'pipe',
        env: { ...process.env }
      });

      // Verify the remote was added
      const remotesOutput = execSync(`cd "${absolutePath}" && git remote -v`, {
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env }
      });

      return {
        success: true,
        message: `Remote '${remoteName}' added successfully to repository at ${absolutePath}`,
        remoteUrl: remoteUrl,
        remotes: remotesOutput.trim()
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to add remote: ${error.message}`,
        path: absolutePath,
        remoteName: remoteName,
        remoteUrl: remoteUrl
      };
    }
  }
}

// Register the tool statically
export const gitHubAddRemoteRegistration: ToolRegistration = {
  name: "github_add_remote",
  description: "Add a remote repository to an existing git repository.",
  category: "github",
  schemaDef: {
    absolutePath: { type: 'string' as const, description: "Absolute path to the git repository" },
    remoteName: { type: 'string' as const, description: "Name of the remote (usually 'origin')" },
    remoteUrl: { type: 'string' as const, description: "URL of the remote repository" },
  },
  workerClass: GitHubAddRemoteWorker,
};
