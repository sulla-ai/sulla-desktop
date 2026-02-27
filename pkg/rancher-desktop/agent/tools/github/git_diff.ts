import { BaseTool, ToolResponse } from "../base";
import { execSync } from 'child_process';
import path from 'path';

/**
 * Git Diff Tool - Show changes between working tree, staging area, or commits.
 */
export class GitDiffWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { absolutePath } = input;
    const staged = input.staged === true;
    const commitA = input.commitA || '';
    const commitB = input.commitB || '';
    const filePath = input.filePath || '';

    try {
      const repoRoot = execSync(`git -C "${absolutePath}" rev-parse --show-toplevel`, {
        stdio: 'pipe',
        env: { ...process.env },
      }).toString().trim();

      let cmd = `git -C "${repoRoot}" diff`;

      if (commitA && commitB) {
        cmd += ` ${commitA} ${commitB}`;
      } else if (commitA) {
        cmd += ` ${commitA}`;
      } else if (staged) {
        cmd += ' --cached';
      }

      if (filePath) {
        cmd += ` -- "${filePath}"`;
      }

      const output = execSync(cmd, {
        stdio: 'pipe',
        env: { ...process.env },
        maxBuffer: 1024 * 1024 * 5,
      }).toString().trim();

      if (!output) {
        return { successBoolean: true, responseString: 'No differences found.' };
      }

      // Cap output
      const lines = output.split('\n');
      const maxLines = 500;
      const truncated = lines.length > maxLines
        ? lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`
        : output;

      return { successBoolean: true, responseString: truncated };
    } catch (error: any) {
      return { successBoolean: false, responseString: `Git diff failed: ${error.message}` };
    }
  }
}
