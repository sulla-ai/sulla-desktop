import { BaseTool, ToolResponse } from '../base';
import { projectRegistry } from '../../database/registry/ProjectRegistry';

/**
 * Create Project Tool - Create a new project folder with PROJECT.md and README.md.
 */
export class CreateProjectWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { project_name, content } = input;
    const result = await projectRegistry.createProject(project_name, content);
    return {
      successBoolean: !result.startsWith('Failed'),
      responseString: result,
    };
  }
}
