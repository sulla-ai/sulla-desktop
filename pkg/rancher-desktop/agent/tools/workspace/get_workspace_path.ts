import { BaseTool, ToolRegistration, ToolResponse } from '../base';

/**
 * Get Workspace Path Tool - Worker class for execution
 */
export class GetWorkspacePathWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { name } = input;
    return {
      successBoolean: true,
      responseString: `workspaces/${name}`
    };
  }
}

// Export the complete tool registration with type enforcement
export const getWorkspacePathRegistration: ToolRegistration = {
  name: 'get_workspace_path',
  description: 'Get the relative path of a workspace in the Rancher Desktop data directory.',
  category: "workspace",
  operationTypes: ['read'],
  schemaDef: {
    name: { type: 'string' as const, description: 'The name of the workspace.' },
  },
  workerClass: GetWorkspacePathWorker,
};
