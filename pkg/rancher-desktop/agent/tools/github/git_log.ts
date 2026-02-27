import { BaseTool, ToolResponse } from "../base";
import { execSync } from 'child_process';
import path from 'path';

/**
 * Git Log Tool - Show commit history.
 */
export class GitLogWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { absolutePath } = input;
    const limit = input.limit ? Number(input.limit) : 20;
    const oneline = input.oneline !== false;

    try {
      const repoRoot = execSync(`git -C "${absolutePath}" rev-parse --show-toplevel`, {
        stdio: 'pipe',
        env: { ...process.env },
      }).toString().trim();

      const format = oneline
        ? '--oneline --decorate'
        : '--format=%H%n%an <%ae>%n%ai%n%s%n';

      const output = execSync(`git -C "${repoRoot}" log ${format} -n ${limit}`, {
        stdio: 'pipe',
        env: { ...process.env },
        maxBuffer: 1024 * 1024 * 2,
      }).toString().trim();

      return {
        successBoolean: true,
        responseString: `Commit log for ${repoRoot} (last ${limit}):\n${output}`,
      };
    } catch (error: any) {
      return { successBoolean: false, responseString: `Git log failed: ${error.message}` };
    }
  }
}
