import type { ThreadState, ToolResult } from '../types';
import { getSkillService } from '../services/SkillService';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class SkillDisableTool extends BaseTool {
  override readonly name = 'skill_disable';
  override readonly category = 'skills';

  override getPlanningInstructions(): string {
    return [
      '36) skill_disable (Skills)',
      '   - Purpose: Disable an enabled skill. The skill will no longer be runnable until re-enabled.',
      '   - Args:',
      '     - skillId (string, required): The ID of the skill to disable',
      '   - Output: Confirmation of disable action.',
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

      await svc.disableSkill(skillId);

      return {
        toolName: this.name,
        success:  true,
        result:   { action: 'disabled', skillId },
      };
    } catch (err) {
      return {
        toolName: this.name,
        success:  false,
        error:    `Failed to disable skill: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
