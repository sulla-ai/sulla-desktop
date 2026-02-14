import { BaseTool } from "../base";
import { z } from "zod";
import { calendarClient } from "../../services/CalendarClient";

export class CalendarDeleteTool extends BaseTool {
  name = "calendar_delete";
  description = "Delete a calendar event by ID.";
  schema = z.object({
    eventId: z.number().describe("The ID of the calendar event to delete"),
  });

  metadata = { category: "calendar" };

  protected async _call(input: z.infer<this["schema"]>) {
    try {
      const success = await calendarClient.delete(input.eventId);
      return success ? "Event deleted successfully" : "Event not found";
    } catch (error) {
      return `Error deleting calendar event: ${(error as Error).message}`;
    }
  }
}
