import { BaseTool, ToolResponse } from "../base";
import { execSync } from 'child_process';
import path from 'path';

/**
 * Git Add Tool - Stages specified files for commit.
 */
export class GitAddWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { absolutePath } = input;
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

      // Show what was staged
      const statusOutput = execSync(`git -C "${repoRoot}" status --short`, {
        stdio: 'pipe',
        env: { ...process.env },
      }).toString().trim();

      const stagedDesc = files.length > 0 ? files.join(', ') : 'all changes';
      return {
        successBoolean: true,
        responseString: `Staged ${stagedDesc} in ${repoRoot}\n${statusOutput}`,
      };
    } catch (error: any) {
      return {
        successBoolean: false,
        responseString: `Git add failed: ${error.message}`,
      };
    }
  }
}
