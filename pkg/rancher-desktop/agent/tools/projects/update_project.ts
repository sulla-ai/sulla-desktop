import { BaseTool, ToolResponse } from '../base';
import { projectRegistry } from '../../database/registry/ProjectRegistry';

/**
 * Update Project Tool - Overwrite the entire PROJECT.md for an existing project.
 */
export class UpdateProjectWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { project_name, content } = input;
    const result = await projectRegistry.updateProject(project_name, content);
    return {
      successBoolean: !result.startsWith('Failed'),
      responseString: result,
    };
  }
}
