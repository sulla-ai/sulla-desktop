import type { ThreadState, ToolResult } from '../types';
import { getCalendarService } from '../services/CalendarService';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class CalendarCreateEventTool extends BaseTool {
  override readonly name = 'calendar_create_event';
  override readonly aliases = ['create_event', 'add_event', 'schedule_event'];
  override readonly category = 'calendar';

  override getPlanningInstructions(): string {
    return [
      '40) calendar_create_event',
      '   - Purpose: Create a new calendar event.',
      '   - Args:',
      '     - title (string, required): Event title',
      '     - start (string, required): ISO date-time string for event start (e.g., "2025-01-31T09:00:00Z")',
      '     - end (string, required): ISO date-time string for event end',
      '     - location (string, optional): Event location',
      '     - description (string, optional): Event description',
      '   - Output: The created event with its assigned id.',
      '   - Use when:',
      '     - User asks to "create an event", "schedule a meeting", "add to calendar"',
      '     - User says "remind me about X at Y time" (create event as reminder)',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "calendar_create_event" and args containing title, start, end',
      '     - Convert user-provided times to ISO format',
    ].join('\n');
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    try {
      const title = context.args?.title as string;
      const start = context.args?.start as string;
      const end = context.args?.end as string;
      const location = context.args?.location as string | undefined;
      const description = context.args?.description as string | undefined;

      if (!title || !start || !end) {
        return {
          toolName: this.name,
          success: false,
          error: 'Missing required arguments: title, start, and end are required.',
        };
      }

      const calendarService = getCalendarService();
      await calendarService.initialize();

      const event = await calendarService.createEvent({
        title,
        start,
        end,
        location,
        description,
      });

      return {
        toolName: this.name,
        success: true,
        result: {
          message: `Created event "${event.title}" (ID: ${event.id})`,
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
