import { BaseTool, ToolRegistration, ToolResponse } from '../base';
import fs from 'fs';
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
    const rdDataDir = path.join(os.homedir(), 'Library/Application Support/rancher-desktop');
    const relativeWorkspacePath = path.join('workspaces', name);
    const absoluteWorkspacePath = path.join(rdDataDir, relativeWorkspacePath);
    try {
      fs.mkdirSync(absoluteWorkspacePath, { recursive: true });
      return {
        successBoolean: true,
        responseString: `Workspace "${name}" created successfully at ${relativeWorkspacePath}`
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
