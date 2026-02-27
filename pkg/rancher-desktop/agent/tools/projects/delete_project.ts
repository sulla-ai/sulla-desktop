import { BaseTool, ToolResponse } from '../base';
import { projectRegistry } from '../../database/registry/ProjectRegistry';

/**
 * Delete Project Tool - Delete a project folder and remove it from the registry.
 */
export class DeleteProjectWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { project_name } = input;
    const result = await projectRegistry.deleteProject(project_name);
    return {
      successBoolean: !result.startsWith('Failed'),
      responseString: result,
    };
  }
}
