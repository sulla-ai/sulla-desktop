import { BaseTool, ToolResponse } from '../base';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Delete Workspace Tool - Worker class for execution
 */
export class DeleteWorkspaceWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { name } = input;
    const rdDataDir = path.join(os.homedir(), 'Library/Application Support/rancher-desktop');
    const relativeWorkspacePath = path.join('workspaces', name);
    const absoluteWorkspacePath = path.join(rdDataDir, relativeWorkspacePath);
    try {
      fs.rmSync(absoluteWorkspacePath, { recursive: true, force: true });
      return {
        successBoolean: true,
        responseString: `Workspace "${name}" deleted successfully from ${relativeWorkspacePath}`
      };
    } catch (error: any) {
      return {
        successBoolean: false,
        responseString: `Failed to delete workspace "${name}": ${error.message}`
      };
    }
  }
}
