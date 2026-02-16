import { BaseTool, ToolRegistration } from "../base";
import { calendarClient } from "../../services/CalendarClient";

/**
 * Calendar Create Tool - Worker class for execution
 */
export class CalendarCreateWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    try {
      const event = await calendarClient.create(input);
      return event;
    } catch (error) {
      return `Error creating calendar event: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const calendarCreateRegistration: ToolRegistration = {
  name: "calendar_create",
  description: "Create a new calendar event or reminder.",
  category: "calendar",
  schemaDef: {
    title: { type: 'string' as const, description: "Event title" },
    start: { type: 'string' as const, description: "Start time in ISO format" },
    end: { type: 'string' as const, description: "End time in ISO format" },
    description: { type: 'string' as const, optional: true, description: "Event description" },
    location: { type: 'string' as const, optional: true, description: "Event location" },
    people: { type: 'array' as const, items: { type: 'string' as const }, optional: true, description: "List of attendee emails" },
    calendarId: { type: 'string' as const, optional: true, description: "Calendar ID" },
    allDay: { type: 'boolean' as const, optional: true, description: "Whether this is an all-day event" },
  },
  workerClass: CalendarCreateWorker,
};
