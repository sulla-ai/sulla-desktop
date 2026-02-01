import type { ThreadState, ToolResult } from '../types';
import { getCalendarService } from '../services/CalendarService';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class CalendarGetEventTool extends BaseTool {
  override readonly name = 'calendar_get_event';
  override readonly aliases = ['get_event', 'find_event'];
  override readonly category = 'calendar';

  override getPlanningInstructions(): string {
    return [
      '39) calendar_get_event',
      '   - Purpose: Get details of a specific calendar event by ID.',
      '   - Args:',
      '     - id (number, required): Event ID to retrieve',
      '   - Output: The event details with id, title, start, end, location, description.',
      '   - Use when:',
      '     - User asks about a specific event by ID',
      '     - You need to get full details of an event before updating it',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "calendar_get_event" with the event id',
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

      const event = await calendarService.getEvent(id);

      if (!event) {
        return {
          toolName: this.name,
          success: false,
          error: `Event with ID ${id} not found.`,
        };
      }

      const formatted = {
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        location: event.location || null,
        description: event.description || null,
      };

      return {
        toolName: this.name,
        success: true,
        result: { event: formatted },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
