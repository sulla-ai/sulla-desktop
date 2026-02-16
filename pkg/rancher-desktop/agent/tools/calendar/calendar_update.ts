import { BaseTool, ToolRegistration } from "../base";
import { calendarClient } from "../../services/CalendarClient";

/**
 * Calendar Update Tool - Worker class for execution
 */
export class CalendarUpdateWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { eventId, ...updates } = input;

    try {
      const updated = await calendarClient.update(eventId, updates);
      return updated || "Event not found";
    } catch (error) {
      return `Error updating calendar event: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const calendarUpdateRegistration: ToolRegistration = {
  name: "calendar_update",
  description: "Update an existing calendar event.",
  category: "calendar",
  schemaDef: {
    eventId: { type: 'number' as const, description: "The ID of the calendar event to update" },
    title: { type: 'string' as const, optional: true, description: "New event title" },
    start: { type: 'string' as const, optional: true, description: "New start time in ISO format" },
    end: { type: 'string' as const, optional: true, description: "New end time in ISO format" },
    description: { type: 'string' as const, optional: true, description: "New event description" },
    location: { type: 'string' as const, optional: true, description: "New event location" },
    people: { type: 'array' as const, items: { type: 'string' as const }, optional: true, description: "New list of attendee emails" },
    calendarId: { type: 'string' as const, optional: true, description: "New calendar ID" },
    allDay: { type: 'boolean' as const, optional: true, description: "New all-day flag" },
  },
  workerClass: CalendarUpdateWorker,
};
