import { BaseTool, ToolResponse } from "../base";
import { execSync } from 'child_process';
import path from 'path';

/**
 * Git Conflicts Tool - Lists files with merge conflicts and shows conflict markers.
 */
export class GitConflictsWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { absolutePath } = input;

    try {
      // Resolve the repo root from the given path
      const repoRoot = execSync(`git -C "${absolutePath}" rev-parse --show-toplevel`, {
        stdio: 'pipe',
        env: { ...process.env },
      }).toString().trim();

      // List unmerged files
      const unmergedOutput = execSync(`git -C "${repoRoot}" diff --name-only --diff-filter=U`, {
        stdio: 'pipe',
        env: { ...process.env },
      }).toString().trim();

      if (!unmergedOutput) {
        return {
          successBoolean: true,
          responseString: `No merge conflicts found in ${repoRoot}.`,
        };
      }

      const conflictFiles = unmergedOutput.split('\n').filter(Boolean);
      const details: string[] = [`Merge conflicts in ${repoRoot}:\n`];

      for (const file of conflictFiles) {
        details.push(`--- ${file} ---`);
        try {
          // Show the conflict markers for each file (limited to first 200 lines)
          const diffOutput = execSync(`git -C "${repoRoot}" diff "${file}" | head -200`, {
            stdio: 'pipe',
            env: { ...process.env },
            shell: '/bin/sh',
          }).toString().trim();
          details.push(diffOutput);
        } catch {
          details.push('(could not read diff)');
        }
        details.push('');
      }

      return {
        successBoolean: true,
        responseString: details.join('\n'),
      };
    } catch (error: any) {
      return {
        successBoolean: false,
        responseString: `Git conflicts check failed: ${error.message}`,
      };
    }
  }
}
