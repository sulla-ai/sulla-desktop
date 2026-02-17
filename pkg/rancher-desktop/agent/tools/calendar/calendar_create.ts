import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { calendarClient } from "../../services/CalendarClient";

/**
 * Calendar Create Tool - Worker class for execution
 */
export class CalendarCreateWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const event = await calendarClient.create(input);
      if (!event) {
        return {
          successBoolean: false,
          responseString: "Failed to create calendar event: no event returned."
        };
      }

      // Format detailed created event information
      const startDate = new Date(event.start).toLocaleString();
      const endDate = event.end ? new Date(event.end).toLocaleString() : 'N/A';
      const responseString = `Event created successfully:
Title: ${event.title || 'N/A'}
Start: ${startDate}
End: ${endDate}
Description: ${event.description || 'N/A'}
Location: ${event.location || 'N/A'}
Attendees: ${event.people ? event.people.join(', ') : 'N/A'}
Status: ${event.status || 'N/A'}
ID: ${event.id || 'N/A'}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error creating calendar event: ${(error as Error).message}`
      };
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
