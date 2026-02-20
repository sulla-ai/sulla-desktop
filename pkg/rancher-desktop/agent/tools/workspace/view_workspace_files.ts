import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * View Workspace Files Tool - Worker class for execution
 */
export class ViewWorkspaceFilesWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { name } = input;
    const rdDataDir = path.join(os.homedir(), 'Library/Application Support/rancher-desktop');
    const relativeWorkspacePath = path.join('workspaces', name);
    const absoluteWorkspacePath = path.join(rdDataDir, relativeWorkspacePath);
    try {
      const entries = fs.readdirSync(absoluteWorkspacePath, { withFileTypes: true });
      const files = entries.map((entry) => `${entry.isDirectory() ? 'd' : '-'} ${entry.name}`);
      return {
        successBoolean: true,
        responseString: `Files in workspace "${name}" (${relativeWorkspacePath}):\n${files.join('\n')}`
      };
    } catch (error: any) {
      return {
        successBoolean: false,
        responseString: `Failed to view workspace "${name}": ${error.message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const viewWorkspaceFilesRegistration: ToolRegistration = {
  name: "view_workspace_files",
  description: "List files in a workspace directory in the Rancher Desktop data directory.",
  category: "workspace",
  schemaDef: {
    name: { type: 'string' as const, description: 'The name of the workspace to view.' },
  },
  workerClass: ViewWorkspaceFilesWorker,
};
