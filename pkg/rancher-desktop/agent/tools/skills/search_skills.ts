import { BaseTool, ToolResponse } from '../base';
import { skillsRegistry } from '../../database/registry/SkillsRegistry';

/**
 * Search Skills Tool - Search available skills by description or tag.
 */
export class SearchSkillsWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { query } = input;
    const result = await skillsRegistry.searchSkills(query);
    return {
      successBoolean: true,
      responseString: result,
    };
  }
}
