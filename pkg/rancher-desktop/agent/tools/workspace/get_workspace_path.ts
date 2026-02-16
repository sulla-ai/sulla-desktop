import { BaseTool, ToolRegistration } from '../base';

/**
 * Get Workspace Path Tool - Worker class for execution
 */
export class GetWorkspacePathWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any) {
    const { name } = input;
    return { success: true, path: `/workspaces/${name}` };
  }
}

// Export the complete tool registration with type enforcement
export const getWorkspacePathRegistration: ToolRegistration = {
  name: 'get_workspace_path',
  description: 'Get the full path of a workspace in the Lima VM.',
  category: "workspace",
  schemaDef: {
    name: { type: 'string' as const, description: 'The name of the workspace.' },
  },
  workerClass: GetWorkspacePathWorker,
};
