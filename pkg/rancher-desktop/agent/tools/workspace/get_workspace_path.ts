import { BaseTool, ToolResponse } from '../base';

/**
 * Get Workspace Path Tool - Worker class for execution
 */
export class GetWorkspacePathWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { name } = input;
    return {
      successBoolean: true,
      responseString: `workspaces/${name}`
    };
  }
}
