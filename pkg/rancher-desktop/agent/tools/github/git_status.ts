import { BaseTool, ToolResponse } from "../base";
import { execSync } from 'child_process';
import path from 'path';

/**
 * Git Status Tool - Show the working tree status.
 */
export class GitStatusWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { absolutePath } = input;

    try {
      const repoRoot = execSync(`git -C "${absolutePath}" rev-parse --show-toplevel`, {
        stdio: 'pipe',
        env: { ...process.env },
      }).toString().trim();

      const currentBranch = execSync(`git -C "${repoRoot}" rev-parse --abbrev-ref HEAD`, {
        stdio: 'pipe',
        env: { ...process.env },
      }).toString().trim();

      const statusOutput = execSync(`git -C "${repoRoot}" status --short`, {
        stdio: 'pipe',
        env: { ...process.env },
      }).toString().trim();

      const response = statusOutput
        ? `Branch: ${currentBranch}\nRepo: ${repoRoot}\n\n${statusOutput}`
        : `Branch: ${currentBranch}\nRepo: ${repoRoot}\n\nWorking tree clean.`;

      return { successBoolean: true, responseString: response };
    } catch (error: any) {
      return { successBoolean: false, responseString: `Git status failed: ${error.message}` };
    }
  }
}
