import { BaseTool } from "../base";
import { z } from "zod";
import { calendarClient } from "../../services/CalendarClient";

export class CalendarCancelTool extends BaseTool {
  name = "calendar_cancel";
  description = "Cancel a calendar event by ID.";
  schema = z.object({
    eventId: z.number().describe("The ID of the calendar event to cancel"),
  });

  metadata = { category: "calendar" };

  protected async _call(input: z.infer<this["schema"]>) {
    try {
      const updated = await calendarClient.cancel(input.eventId);
      return updated || "Event not found";
    } catch (error) {
      return `Error canceling calendar event: ${(error as Error).message}`;
    }
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('calendar_cancel', async () => new CalendarCancelTool(), 'calendar');
