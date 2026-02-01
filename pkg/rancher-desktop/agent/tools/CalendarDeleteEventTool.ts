import type { ThreadState, ToolResult } from '../types';
import { getCalendarService } from '../services/CalendarService';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class CalendarDeleteEventTool extends BaseTool {
  override readonly name = 'calendar_delete_event';
  override readonly aliases = ['delete_event', 'remove_event', 'cancel_event'];
  override readonly category = 'calendar';

  override getPlanningInstructions(): string {
    return [
      '42) calendar_delete_event',
      '   - Purpose: Delete a calendar event.',
      '   - Args:',
      '     - id (number, required): Event ID to delete',
      '   - Output: Confirmation of deletion.',
      '   - Use when:',
      '     - User asks to "delete", "remove", or "cancel" an event',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - You may need to first use calendar_list_events to find the event ID',
      '     - Include a step with action "calendar_delete_event" with the event id',
    ].join('\n');
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    try {
      const id = Number(context.args?.id);
      if (!Number.isFinite(id) || id <= 0) {
        return {
          toolName: this.name,
          success: false,
          error: 'Missing or invalid required argument: id must be a positive number.',
        };
      }

      const calendarService = getCalendarService();
      await calendarService.initialize();

      const deleted = await calendarService.deleteEvent(id);

      if (!deleted) {
        return {
          toolName: this.name,
          success: false,
          error: `Event with ID ${id} not found or could not be deleted.`,
        };
      }

      return {
        toolName: this.name,
        success: true,
        result: {
          message: `Deleted event with ID ${id}`,
          deletedId: id,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
