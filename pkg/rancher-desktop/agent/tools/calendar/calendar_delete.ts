import { BaseTool, ToolRegistration } from "../base";
import { calendarClient } from "../../services/CalendarClient";

/**
 * Calendar Delete Tool - Worker class for execution
 */
export class CalendarDeleteWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { eventId } = input;

    try {
      const success = await calendarClient.delete(eventId);
      return success ? "Event deleted successfully" : "Event not found";
    } catch (error) {
      return `Error deleting calendar event: ${(error as Error).message}`;
    }
  }
}

// Export the complete tool registration with type enforcement
export const calendarDeleteRegistration: ToolRegistration = {
  name: "calendar_delete",
  description: "Delete a calendar event by ID.",
  category: "calendar",
  schemaDef: {
    eventId: { type: 'number' as const, description: "The ID of the calendar event to delete" },
  },
  workerClass: CalendarDeleteWorker,
};
