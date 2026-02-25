import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { calendarClient } from "../../services/CalendarClient";

/**
 * Calendar Cancel Tool - Worker class for execution
 */
export class CalendarCancelWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { eventId } = input;

    try {
      const updated = await calendarClient.cancel(eventId);
      if (!updated) {
        return {
          successBoolean: false,
          responseString: `Event with ID ${eventId} not found.`
        };
      }

      // Format detailed canceled event information
      const startDate = new Date(updated.start).toLocaleString();
      const endDate = updated.end ? new Date(updated.end).toLocaleString() : 'N/A';
      const responseString = `Event canceled successfully:
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
        responseString: `Error canceling calendar event: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const calendarCancelRegistration: ToolRegistration = {
  name: "calendar_cancel",
  description: "Cancel a calendar event by ID.",
  category: "calendar",
  operationTypes: ['delete'],
  schemaDef: {
    eventId: { type: 'number' as const, description: "The ID of the calendar event to cancel" },
  },
  workerClass: CalendarCancelWorker,
};
