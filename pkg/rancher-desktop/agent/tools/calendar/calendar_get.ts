import { BaseTool, ToolRegistration } from "../base";
import { calendarClient } from "../../services/CalendarClient";

/**
 * Calendar Get Tool - Worker class for execution
 */
export class CalendarGetWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { eventId } = input;

    try {
      const event = await calendarClient.get(eventId);
      return event || "Event not found";
    } catch (error) {
      return `Error getting calendar event: ${(error as Error).message}`;
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
