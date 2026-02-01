import type { ThreadState, ToolResult } from '../types';
import { getSkillService } from '../services/SkillService';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class SkillListTool extends BaseTool {
  override readonly name = 'skill_list';
  override readonly category = 'skills';

  override getPlanningInstructions(): string {
    return [
      '32) skill_list (Skills)',
      '   - Purpose: List all available skills from the marketplace so you can install new skills.',
      '   - Args: none',
      '   - Output: Array of skills with id, name, description, tags, isInstalled, and isEnabled status.',
      '   - Use this to discover what skills are available before installing/enabling/running them.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, _context: ToolContext): Promise<ToolResult> {
    try {
      const svc = getSkillService();
      await svc.initialize();

      const catalog = await svc.listCatalog();
      const enabledIds = new Set((await svc.listEnabledSkills()).map(s => s.id));

      const skills = await Promise.all(catalog.map(async entry => ({
        id:          entry.id,
        name:        entry.name,
        description: entry.shortDescription,
        tags:        entry.tags,
        isInstalled: await svc.isSkillInstalled(entry.id),
        isEnabled:   enabledIds.has(entry.id),
      })));

      return {
        toolName: this.name,
        success:  true,
        result:   { skills, count: skills.length },
      };
    } catch (err) {
      return {
        toolName: this.name,
        success:  false,
        error:    `Failed to list skills: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
