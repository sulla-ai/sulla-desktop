import { BaseTool, ToolRegistration } from "../base";
import { calendarClient } from "../../services/CalendarClient";

/**
 * Calendar Cancel Tool - Worker class for execution
 */
export class CalendarCancelWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { eventId } = input;

    try {
      const updated = await calendarClient.cancel(eventId);
      return updated || "Event not found";
    } catch (error) {
      return `Error canceling calendar event: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const calendarCancelRegistration: ToolRegistration = {
  name: "calendar_cancel",
  description: "Cancel a calendar event by ID.",
  category: "calendar",
  schemaDef: {
    eventId: { type: 'number' as const, description: "The ID of the calendar event to cancel" },
  },
  workerClass: CalendarCancelWorker,
};
