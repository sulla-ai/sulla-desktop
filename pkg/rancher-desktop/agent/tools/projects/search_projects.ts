import { BaseTool, ToolResponse } from '../base';
import { projectRegistry } from '../../database/registry/ProjectRegistry';

/**
 * Search Projects Tool - Search available projects by name, description, status, or tag.
 */
export class SearchProjectsWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { query } = input;
    const result = await projectRegistry.searchProjects(query);
    return {
      successBoolean: true,
      responseString: result,
    };
  }
}
