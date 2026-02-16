import { BaseTool, ToolRegistration } from "../base";
import { calendarClient } from "../../services/CalendarClient";

/**
 * Calendar List Upcoming Tool - Worker class for execution
 */
export class CalendarListUpcomingWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { days = 7 } = input;

    try {
      const now = new Date();
      const startAfter = now.toISOString();
      const endBefore = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

      const events = await calendarClient.getEvents({ startAfter, endBefore });
      return events;
    } catch (error) {
      return `Error listing upcoming calendar events: ${(error as Error).message}`;
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
