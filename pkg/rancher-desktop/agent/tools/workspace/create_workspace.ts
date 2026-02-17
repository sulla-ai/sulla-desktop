import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import { execSync } from 'child_process';
import path from 'path';
import os from 'os';

/**
 * Create Workspace Tool - Worker class for execution
 */
export class CreateWorkspaceWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { name } = input;
    const limaHome = path.join(os.homedir(), 'Library/Application Support/rancher-desktop/lima');
    const limactlPath = path.join(__dirname, '../../../resources/darwin/lima/bin/limactl');
    try {
      execSync(`${limactlPath} shell 0 -- mkdir -p /workspaces/${name}`, {
        env: { ...process.env, LIMA_HOME: limaHome }
      });
      return {
        successBoolean: true,
        responseString: `Workspace "${name}" created successfully at /workspaces/${name}`
      };
    } catch (error: any) {
      return {
        successBoolean: false,
        responseString: `Failed to create workspace "${name}": ${error.message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const createWorkspaceRegistration: ToolRegistration = {
  name: 'create_workspace',
  description: 'Create a new workspace directory in the Lima VM.',
  category: "workspace",
  schemaDef: {
    name: { type: 'string' as const, description: 'The name of the workspace to create.' },
  },
  workerClass: CreateWorkspaceWorker,
};
