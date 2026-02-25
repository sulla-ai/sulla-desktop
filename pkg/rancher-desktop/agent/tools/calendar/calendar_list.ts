import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { calendarClient } from "../../services/CalendarClient";

/**
 * Calendar List Tool - Worker class for execution
 */
export class CalendarListWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const events = await calendarClient.getEvents(input);
      if (!events || events.length === 0) {
        return {
          successBoolean: false,
          responseString: "No calendar events found for the specified criteria."
        };
      }

      // Format detailed list of events
      let responseString = `Calendar Events (${events.length} found):\n\n`;
      events.forEach((event: any, index: number) => {
        const startDate = new Date(event.attributes.start).toLocaleString();
        const endDate = event.attributes.end ? new Date(event.attributes.end).toLocaleString() : 'N/A';
        responseString += `${index + 1}. Title: ${event.attributes.title || 'N/A'}\n`;
        responseString += `   Start: ${startDate}\n`;
        responseString += `   End: ${endDate}\n`;
        responseString += `   Description: ${event.attributes.description || 'N/A'}\n`;
        responseString += `   People: ${event.attributes.people ? event.attributes.people.join(', ') : 'N/A'}\n`;
        responseString += `   Status: ${event.attributes.status || 'N/A'}\n\n`;
      });

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error listing calendar events: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const calendarListRegistration: ToolRegistration = {
  name: "calendar_list",
  description: "List calendar events within a date range.",
  category: "calendar",
  operationTypes: ['read'],
  schemaDef: {
    startAfter: { type: 'string' as const, optional: true, description: "Start date filter in ISO format" },
    endBefore: { type: 'string' as const, optional: true, description: "End date filter in ISO format" },
    calendarId: { type: 'string' as const, optional: true, description: "Calendar ID filter" },
  },
  workerClass: CalendarListWorker,
};
