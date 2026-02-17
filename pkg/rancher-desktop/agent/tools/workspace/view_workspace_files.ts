import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { execSync } from 'child_process';
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
    const limaHome = path.join(os.homedir(), 'Library/Application Support/rancher-desktop/lima');
    const limactlPath = path.join(__dirname, '../../../resources/darwin/lima/bin/limactl');
    try {
      const output = execSync(`${limactlPath} shell 0 -- ls -la /workspaces/${name}`, {
        env: { ...process.env, LIMA_HOME: limaHome },
        encoding: 'utf-8'
      });
      const files = output.trim().split('\n');
      return {
        successBoolean: true,
        responseString: `Files in workspace "${name}" (/workspaces/${name}):\n${files.join('\n')}`
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
  description: "List files in a workspace directory in the Lima VM.",
  category: "workspace",
  schemaDef: {
    name: { type: 'string' as const, description: 'The name of the workspace to view.' },
  },
  workerClass: ViewWorkspaceFilesWorker,
};
