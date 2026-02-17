import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { calendarClient } from "../../services/CalendarClient";

/**
 * Calendar Get Tool - Worker class for execution
 */
export class CalendarGetWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { eventId } = input;

    try {
      const event = await calendarClient.get(eventId);
      if (!event) {
        return {
          successBoolean: false,
          responseString: `Event with ID ${eventId} not found.`
        };
      }

      // Format detailed event information
      const startDate = new Date(event.start).toLocaleString();
      const endDate = event.end ? new Date(event.end).toLocaleString() : 'N/A';
      const responseString = `Event Details:
Title: ${event.title || 'N/A'}
Start: ${startDate}
End: ${endDate}
Description: ${event.description || 'N/A'}
Location: ${event.location || 'N/A'}
Attendees: ${event.people ? event.people.join(', ') : 'N/A'}
Status: ${event.status || 'N/A'}`;

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error getting calendar event: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const calendarGetRegistration: ToolRegistration = {
  name: "calendar_get",
  description: "Get details of a specific calendar event by ID.",
  category: "calendar",
  schemaDef: {
    eventId: { type: 'number' as const, description: "The ID of the calendar event" },
  },
  workerClass: CalendarGetWorker,
};
