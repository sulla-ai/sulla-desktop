import type { ThreadState, ToolResult } from '../types';
import { getSkillService } from '../services/SkillService';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class SkillEnableTool extends BaseTool {
  override readonly name = 'skill_enable';
  override readonly category = 'skills';

  override getPlanningInstructions(): string {
    return [
      '33) skill_enable (Skills)',
      '   - Purpose: Enable or disable a skill by its ID. Skills must be enabled before they can be run.',
      '   - Args:',
      '     - skillId (string, required): The ID of the skill to enable/disable',
      '     - enable (boolean, optional, default true): Set to false to disable the skill',
      '   - Output: Confirmation of enable/disable action.',
      '   - IMPORTANT: You must enable a skill before using skill_run_plugin to execute it.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const skillId = String(context.args?.skillId || '');
    const enable = context.args?.enable !== false;

    if (!skillId) {
      return { toolName: this.name, success: false, error: 'Missing args: skillId' };
    }

    try {
      const svc = getSkillService();
      await svc.initialize();

      if (enable) {
        const meta = await svc.getSkillMetaById(skillId);
        if (!meta) {
          return {
            toolName: this.name,
            success:  false,
            error:    `Skill not found: ${skillId}`,
          };
        }
        await svc.enableSkill(meta);
        return {
          toolName: this.name,
          success:  true,
          result:   { action: 'enabled', skillId, title: meta.title },
        };
      } else {
        await svc.disableSkill(skillId);
        return {
          toolName: this.name,
          success:  true,
          result:   { action: 'disabled', skillId },
        };
      }
    } catch (err) {
      return {
        toolName: this.name,
        success:  false,
        error:    `Failed to ${enable ? 'enable' : 'disable'} skill: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
