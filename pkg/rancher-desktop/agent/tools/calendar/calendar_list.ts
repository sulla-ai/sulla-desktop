import { BaseTool, ToolRegistration } from "../base";
import { calendarClient } from "../../services/CalendarClient";

/**
 * Calendar List Tool - Worker class for execution
 */
export class CalendarListWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    try {
      const events = await calendarClient.getEvents(input);
      return events;
    } catch (error) {
      return `Error listing calendar events: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const calendarListRegistration: ToolRegistration = {
  name: "calendar_list",
  description: "List calendar events within a date range.",
  category: "calendar",
  schemaDef: {
    startAfter: { type: 'string' as const, optional: true, description: "Start date filter in ISO format" },
    endBefore: { type: 'string' as const, optional: true, description: "End date filter in ISO format" },
    calendarId: { type: 'string' as const, optional: true, description: "Calendar ID filter" },
  },
  workerClass: CalendarListWorker,
};
