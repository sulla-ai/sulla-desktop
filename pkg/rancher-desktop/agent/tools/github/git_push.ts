import { BaseTool, ToolResponse } from "../base";
import { execSync } from 'child_process';
import path from 'path';

/**
 * Git Push Tool - Pushes commits to a remote.
 */
export class GitPushWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { absolutePath } = input;
    const remote = input.remote || 'origin';
    const branch = input.branch || '';

    try {
      // Resolve the repo root from the given path
      const repoRoot = execSync(`git -C "${absolutePath}" rev-parse --show-toplevel`, {
        stdio: 'pipe',
        env: { ...process.env },
      }).toString().trim();

      // Determine branch to push — use provided or current branch
      const targetBranch = branch || execSync(`git -C "${repoRoot}" rev-parse --abbrev-ref HEAD`, {
        stdio: 'pipe',
        env: { ...process.env },
      }).toString().trim();

      const pushOutput = execSync(`git -C "${repoRoot}" push ${remote} ${targetBranch}`, {
        stdio: 'pipe',
        env: { ...process.env },
      }).toString().trim();

      return {
        successBoolean: true,
        responseString: `Push successful: ${remote}/${targetBranch} in ${repoRoot}\n${pushOutput}`,
      };
    } catch (error: any) {
      return {
        successBoolean: false,
        responseString: `Git push failed: ${error.message}`,
      };
    }
  }
}
