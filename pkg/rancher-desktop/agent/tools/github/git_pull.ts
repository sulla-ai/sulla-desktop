import { BaseTool, ToolResponse } from "../base";
import { execSync } from 'child_process';
import path from 'path';

/**
 * Git Pull Tool - Pulls from a remote repository.
 */
export class GitPullWorker extends BaseTool {
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

      // Determine branch — use provided or current branch
      const targetBranch = branch || execSync(`git -C "${repoRoot}" rev-parse --abbrev-ref HEAD`, {
        stdio: 'pipe',
        env: { ...process.env },
      }).toString().trim();

      const pullOutput = execSync(`git -C "${repoRoot}" pull ${remote} ${targetBranch}`, {
        stdio: 'pipe',
        env: { ...process.env },
      }).toString().trim();

      // Check for merge conflicts after pull
      let conflictInfo = '';
      try {
        const conflictFiles = execSync(`git -C "${repoRoot}" diff --name-only --diff-filter=U`, {
          stdio: 'pipe',
          env: { ...process.env },
        }).toString().trim();

        if (conflictFiles) {
          conflictInfo = `\n\nMERGE CONFLICTS detected in:\n${conflictFiles}`;
        }
      } catch {
        // diff command failure is non-fatal
      }

      return {
        successBoolean: true,
        responseString: `Pull successful: ${remote}/${targetBranch} in ${repoRoot}\n${pullOutput}${conflictInfo}`,
      };
    } catch (error: any) {
      // Pull failure often means merge conflicts — try to report them
      let conflictInfo = '';
      try {
        const repoRoot = execSync(`git -C "${absolutePath}" rev-parse --show-toplevel`, {
          stdio: 'pipe',
          env: { ...process.env },
        }).toString().trim();

        const conflictFiles = execSync(`git -C "${repoRoot}" diff --name-only --diff-filter=U`, {
          stdio: 'pipe',
          env: { ...process.env },
        }).toString().trim();

        if (conflictFiles) {
          conflictInfo = `\nMERGE CONFLICTS in:\n${conflictFiles}`;
        }
      } catch {
        // ignore
      }

      return {
        successBoolean: false,
        responseString: `Git pull failed: ${error.message}${conflictInfo}`,
      };
    }
  }
}
