import type { ThreadState, ToolResult } from '../types';
import { getCalendarService } from '../services/CalendarService';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class CalendarUpdateEventTool extends BaseTool {
  override readonly name = 'calendar_update_event';
  override readonly aliases = ['update_event', 'edit_event', 'modify_event'];
  override readonly category = 'calendar';

  override getPlanningInstructions(): string {
    return [
      '1) calendar_update_event',
      '   - Purpose: Update an existing calendar event.',
      '   - Args:',
      '     - id (number, required): Event ID to update',
      '     - title (string, optional): New event title',
      '     - start (string, optional): New ISO date-time string for event start',
      '     - end (string, optional): New ISO date-time string for event end',
      '     - location (string, optional): New event location',
      '     - description (string, optional): New event description',
      '   - Output: The updated event.',
      '   - Use when:',
      '     - User asks to "change", "update", "edit", or "reschedule" an event',
      '     - User wants to modify event details',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - You may need to first use calendar_list_events to find the event ID',
      '     - Include a step with action "calendar_update_event" with id and fields to update',
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

      const updates: Record<string, unknown> = {};
      if (context.args?.title !== undefined) {
        updates.title = context.args.title;
      }
      if (context.args?.start !== undefined) {
        updates.start = context.args.start;
      }
      if (context.args?.end !== undefined) {
        updates.end = context.args.end;
      }
      if (context.args?.location !== undefined) {
        updates.location = context.args.location;
      }
      if (context.args?.description !== undefined) {
        updates.description = context.args.description;
      }

      if (Object.keys(updates).length === 0) {
        return {
          toolName: this.name,
          success: false,
          error: 'No fields to update. Provide at least one of: title, start, end, location, description.',
        };
      }

      const calendarService = getCalendarService();
      await calendarService.initialize();

      const event = await calendarService.updateEvent(id, updates);

      if (!event) {
        return {
          toolName: this.name,
          success: false,
          error: `Event with ID ${id} not found.`,
        };
      }

      return {
        toolName: this.name,
        success: true,
        result: {
          message: `Updated event "${event.title}" (ID: ${event.id})`,
          event: {
            id: event.id,
            title: event.title,
            start: event.start,
            end: event.end,
            location: event.location || null,
            description: event.description || null,
          },
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
