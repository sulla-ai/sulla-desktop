import { BaseTool } from "../base";
import { z } from "zod";
import { calendarClient } from "../../services/CalendarClient";

export class CalendarGetTool extends BaseTool {
  name = "calendar_get";
  description = "Get details of a specific calendar event by ID.";
  schema = z.object({
    eventId: z.number().describe("The ID of the calendar event"),
  });

  metadata = { category: "calendar" };

  protected async _call(input: z.infer<this["schema"]>) {
    try {
      const event = await calendarClient.get(input.eventId);
      return event || "Event not found";
    } catch (error) {
      return `Error getting calendar event: ${(error as Error).message}`;
    }
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('calendar_get', async () => new CalendarGetTool(), 'calendar');
