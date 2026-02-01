import type { ThreadState, ToolResult } from '../types';
import { getSkillService } from '../services/SkillService';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class SkillInstallTool extends BaseTool {
  override readonly name = 'skill_install';
  override readonly category = 'skills';

  override getPlanningInstructions(): string {
    return [
      '35) skill_install (Skills)',
      '   - Purpose: Install a skill from the catalog. Builtin skills are already installed.',
      '   - Args:',
      '     - skillId (string, required): The ID of the skill to install',
      '   - Output: Confirmation of installation.',
      '   - Note: After installing, you must still enable the skill with skill_enable before running it.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const skillId = String(context.args?.skillId || '');

    if (!skillId) {
      return { toolName: this.name, success: false, error: 'Missing args: skillId' };
    }

    try {
      const svc = getSkillService();
      await svc.initialize();

      const result = await svc.installSkill(skillId);

      if (!result.success) {
        return {
          toolName: this.name,
          success:  false,
          error:    result.error || 'Installation failed',
        };
      }

      return {
        toolName: this.name,
        success:  true,
        result:   { action: 'installed', skillId },
      };
    } catch (err) {
      return {
        toolName: this.name,
        success:  false,
        error:    `Failed to install skill: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
