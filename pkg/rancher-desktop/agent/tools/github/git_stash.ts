import { BaseTool, ToolResponse } from "../base";
import { execSync } from 'child_process';
import path from 'path';

/**
 * Git Stash Tool - Save, list, apply, or drop stashed changes.
 */
export class GitStashWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { absolutePath, action } = input;
    const message = input.message || '';

    try {
      const repoRoot = execSync(`git -C "${absolutePath}" rev-parse --show-toplevel`, {
        stdio: 'pipe',
        env: { ...process.env },
      }).toString().trim();

      switch (action) {
        case 'save':
        case 'push': {
          const cmd = message
            ? `git -C "${repoRoot}" stash push -m "${message.replace(/"/g, '\\"')}"`
            : `git -C "${repoRoot}" stash push`;
          const output = execSync(cmd, { stdio: 'pipe', env: { ...process.env } }).toString().trim();
          return { successBoolean: true, responseString: output || 'Changes stashed.' };
        }

        case 'list': {
          const output = execSync(`git -C "${repoRoot}" stash list`, {
            stdio: 'pipe',
            env: { ...process.env },
          }).toString().trim();
          return { successBoolean: true, responseString: output || 'No stashes.' };
        }

        case 'apply': {
          const stashRef = input.stashRef || 'stash@{0}';
          const output = execSync(`git -C "${repoRoot}" stash apply "${stashRef}"`, {
            stdio: 'pipe',
            env: { ...process.env },
          }).toString().trim();
          return { successBoolean: true, responseString: output || `Applied ${stashRef}.` };
        }

        case 'pop': {
          const stashRef = input.stashRef || 'stash@{0}';
          const output = execSync(`git -C "${repoRoot}" stash pop "${stashRef}"`, {
            stdio: 'pipe',
            env: { ...process.env },
          }).toString().trim();
          return { successBoolean: true, responseString: output || `Popped ${stashRef}.` };
        }

        case 'drop': {
          const stashRef = input.stashRef || 'stash@{0}';
          const output = execSync(`git -C "${repoRoot}" stash drop "${stashRef}"`, {
            stdio: 'pipe',
            env: { ...process.env },
          }).toString().trim();
          return { successBoolean: true, responseString: output || `Dropped ${stashRef}.` };
        }

        default:
          return { successBoolean: false, responseString: `Unknown action '${action}'. Use: save, list, apply, pop, drop.` };
      }
    } catch (error: any) {
      return { successBoolean: false, responseString: `Git stash failed: ${error.message}` };
    }
  }
}
