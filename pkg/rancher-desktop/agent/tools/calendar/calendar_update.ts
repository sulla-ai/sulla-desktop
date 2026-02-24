import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { calendarClient } from "../../services/CalendarClient";

/**
 * Calendar Update Tool - Worker class for execution
 */
export class CalendarUpdateWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { eventId, ...updates } = input;

    try {
      const updated = await calendarClient.update(eventId, updates);
      if (!updated) {
        return {
          successBoolean: false,
          responseString: `Event with ID ${eventId} not found.`
        };
      }

      // Format detailed updated event information
      const startDate = new Date(updated.start).toLocaleString();
      const endDate = updated.end ? new Date(updated.end).toLocaleString() : 'N/A';
      const responseString = `Event updated successfully:
Title: ${updated.title || 'N/A'}
Start: ${startDate}
End: ${endDate}
Description: ${updated.description || 'N/A'}
Location: ${updated.location || 'N/A'}
Attendees: ${updated.people ? updated.people.join(', ') : 'N/A'}
Status: ${updated.status || 'N/A'}
ID: ${updated.id || 'N/A'}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error updating calendar event: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const calendarUpdateRegistration: ToolRegistration = {
  name: "calendar_update",
  description: "Update an existing calendar event.",
  category: "calendar",
  operationTypes: ['update'],
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
