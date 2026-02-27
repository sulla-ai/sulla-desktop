import { BaseTool, ToolResponse } from '../base';
import { projectRegistry } from '../../database/registry/ProjectRegistry';

/**
 * Patch Project Tool - Update a specific markdown section of a PROJECT.md.
 */
export class PatchProjectWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { project_name, section, content } = input;
    const result = await projectRegistry.patchProject(project_name, section, content);
    return {
      successBoolean: !result.startsWith('Failed'),
      responseString: result,
    };
  }
}
