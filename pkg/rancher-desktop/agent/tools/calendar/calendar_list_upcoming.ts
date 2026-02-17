import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { calendarClient } from "../../services/CalendarClient";

/**
 * Calendar List Upcoming Tool - Worker class for execution
 */
export class CalendarListUpcomingWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { days = 7 } = input;

    try {
      const now = new Date();
      const startAfter = now.toISOString();
      const endBefore = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

      const events = await calendarClient.getEvents({ startAfter, endBefore });
      if (!events || events.length === 0) {
        return {
          successBoolean: false,
          responseString: `No upcoming calendar events found in the next ${days} days.`
        };
      }

      // Format detailed list of upcoming events
      let responseString = `Upcoming Calendar Events (next ${days} days, ${events.length} found):\n\n`;
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
        responseString: `Error listing upcoming calendar events: ${(error as Error).message}`
      };
    }
  }
}

// Export the complete tool registration with type enforcement
export const calendarListUpcomingRegistration: ToolRegistration = {
  name: "calendar_list_upcoming",
  description: "List upcoming calendar events for the next specified number of days.",
  category: "calendar",
  schemaDef: {
    days: { type: 'number' as const, default: 7, description: "Number of days from now to list upcoming events" },
  },
  workerClass: CalendarListUpcomingWorker,
};
