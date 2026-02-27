import { BaseTool, ToolResponse } from "../base";
import { execSync } from 'child_process';
import path from 'path';

/**
 * Git Branch Tool - Create, switch, delete, or list branches.
 */
export class GitBranchWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { absolutePath, action } = input;
    const branchName = input.branchName || '';

    try {
      const repoRoot = execSync(`git -C "${absolutePath}" rev-parse --show-toplevel`, {
        stdio: 'pipe',
        env: { ...process.env },
      }).toString().trim();

      switch (action) {
        case 'list': {
          const output = execSync(`git -C "${repoRoot}" branch -a --no-color`, {
            stdio: 'pipe',
            env: { ...process.env },
          }).toString().trim();
          return { successBoolean: true, responseString: `Branches in ${repoRoot}:\n${output}` };
        }

        case 'create': {
          if (!branchName) return { successBoolean: false, responseString: 'branchName is required for create.' };
          execSync(`git -C "${repoRoot}" checkout -b "${branchName}"`, {
            stdio: 'pipe',
            env: { ...process.env },
          });
          return { successBoolean: true, responseString: `Created and switched to branch '${branchName}' in ${repoRoot}` };
        }

        case 'switch': {
          if (!branchName) return { successBoolean: false, responseString: 'branchName is required for switch.' };
          execSync(`git -C "${repoRoot}" checkout "${branchName}"`, {
            stdio: 'pipe',
            env: { ...process.env },
          });
          return { successBoolean: true, responseString: `Switched to branch '${branchName}' in ${repoRoot}` };
        }

        case 'delete': {
          if (!branchName) return { successBoolean: false, responseString: 'branchName is required for delete.' };
          const output = execSync(`git -C "${repoRoot}" branch -d "${branchName}"`, {
            stdio: 'pipe',
            env: { ...process.env },
          }).toString().trim();
          return { successBoolean: true, responseString: `${output}` };
        }

        default:
          return { successBoolean: false, responseString: `Unknown action '${action}'. Use: list, create, switch, delete.` };
      }
    } catch (error: any) {
      return { successBoolean: false, responseString: `Git branch failed: ${error.message}` };
    }
  }
}
