import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { execSync } from 'child_process';
import path from 'path';
import os from 'os';

/**
 * Delete Workspace Tool - Worker class for execution
 */
export class DeleteWorkspaceWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { name } = input;
    const limaHome = path.join(os.homedir(), 'Library/Application Support/rancher-desktop/lima');
    const limactlPath = path.join(__dirname, '../../../resources/darwin/lima/bin/limactl');
    try {
      execSync(`${limactlPath} shell 0 -- rm -rf /workspaces/${name}`, {
        env: { ...process.env, LIMA_HOME: limaHome }
      });
      return {
        successBoolean: true,
        responseString: `Workspace "${name}" deleted successfully from /workspaces/${name}`
      };
    } catch (error: any) {
      return {
        successBoolean: false,
        responseString: `Failed to delete workspace "${name}": ${error.message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const deleteWorkspaceRegistration: ToolRegistration = {
  name: 'delete_workspace',
  description: 'Delete an existing workspace directory in the Lima VM.',
  category: "workspace",
  schemaDef: {
    name: { type: 'string' as const, description: 'The name of the workspace to delete.' },
  },
  workerClass: DeleteWorkspaceWorker,
};
