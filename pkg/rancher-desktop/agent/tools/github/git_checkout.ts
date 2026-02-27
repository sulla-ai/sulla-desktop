import { BaseTool, ToolResponse } from "../base";
import { execSync } from 'child_process';
import path from 'path';

/**
 * Git Checkout Tool - Restore files from a commit, branch, or discard working tree changes.
 */
export class GitCheckoutWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { absolutePath } = input;
    const files: string[] = Array.isArray(input.files) ? input.files : [];
    const ref = input.ref || '';

    try {
      const repoRoot = execSync(`git -C "${absolutePath}" rev-parse --show-toplevel`, {
        stdio: 'pipe',
        env: { ...process.env },
      }).toString().trim();

      if (files.length === 0) {
        return {
          successBoolean: false,
          responseString: 'files parameter is required. Provide absolute file paths to restore.',
        };
      }

      const fileArgs = files.map(f => `"${f}"`).join(' ');
      const cmd = ref
        ? `git -C "${repoRoot}" checkout ${ref} -- ${fileArgs}`
        : `git -C "${repoRoot}" checkout -- ${fileArgs}`;

      execSync(cmd, { stdio: 'pipe', env: { ...process.env } });

      const refDesc = ref || 'HEAD';
      return {
        successBoolean: true,
        responseString: `Restored ${files.length} file(s) from ${refDesc}:\n${files.join('\n')}`,
      };
    } catch (error: any) {
      return { successBoolean: false, responseString: `Git checkout failed: ${error.message}` };
    }
  }
}
