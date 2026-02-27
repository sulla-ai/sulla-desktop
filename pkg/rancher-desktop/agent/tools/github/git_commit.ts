import { BaseTool, ToolResponse } from "../base";
import { execSync } from 'child_process';
import path from 'path';

/**
 * Git Commit Tool - Stages specified files and commits them.
 */
export class GitCommitWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { absolutePath, message } = input;
    const files: string[] = Array.isArray(input.files) ? input.files : [];

    try {
      // Resolve the repo root from the given path
      const repoRoot = execSync(`git -C "${absolutePath}" rev-parse --show-toplevel`, {
        stdio: 'pipe',
        env: { ...process.env },
      }).toString().trim();

      // Stage files — if none specified, stage everything
      if (files.length > 0) {
        for (const file of files) {
          execSync(`git -C "${repoRoot}" add "${file}"`, {
            stdio: 'pipe',
            env: { ...process.env },
          });
        }
      } else {
        execSync(`git -C "${repoRoot}" add -A`, {
          stdio: 'pipe',
          env: { ...process.env },
        });
      }

      // Commit
      const commitOutput = execSync(`git -C "${repoRoot}" commit -m "${message.replace(/"/g, '\\"')}"`, {
        stdio: 'pipe',
        env: { ...process.env },
      }).toString().trim();

      return {
        successBoolean: true,
        responseString: `Commit successful in ${repoRoot}:\n${commitOutput}`,
      };
    } catch (error: any) {
      return {
        successBoolean: false,
        responseString: `Git commit failed: ${error.message}`,
      };
    }
  }
}
