import { BaseTool, ToolResponse } from "../base";
import { execSync } from 'child_process';

/**
 * GitHub Add Remote Tool - Worker class for execution
 */
export class GitHubAddRemoteWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
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

      const responseString = `Remote '${remoteName}' added successfully to repository at ${absolutePath}.
Remote URL: ${remoteUrl}
Current remotes:
${remotesOutput.trim()}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error: any) {
      return {
        successBoolean: false,
        responseString: `Failed to add remote '${remoteName}' to repository at ${absolutePath}: ${error.message}`
      };
    }
  }
}
