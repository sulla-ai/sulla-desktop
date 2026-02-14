import { BaseTool } from "../base";
import { z } from "zod";
import { calendarClient } from "../../services/CalendarClient";

export class CalendarListUpcomingTool extends BaseTool {
  name = "calendar_list_upcoming";
  description = "List upcoming calendar events for the next specified number of days.";
  schema = z.object({
    days: z.number().default(7).describe("Number of days from now to list upcoming events"),
  });

  metadata = { category: "calendar" };

  protected async _call(input: z.infer<this["schema"]>) {
    try {
      const days = input.days;
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

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('calendar_list_upcoming', async () => new CalendarListUpcomingTool(), 'calendar');
