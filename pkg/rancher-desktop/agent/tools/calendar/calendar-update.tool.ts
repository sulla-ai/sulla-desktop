import { BaseTool } from "../base";
import { z } from "zod";
import { calendarClient } from "../../services/CalendarClient";

export class CalendarUpdateTool extends BaseTool {
  name = "calendar_update";
  description = "Update an existing calendar event.";
  schema = z.object({
    eventId: z.number().describe("The ID of the calendar event to update"),
    title: z.string().optional().describe("New event title"),
    start: z.string().optional().describe("New start time in ISO format"),
    end: z.string().optional().describe("New end time in ISO format"),
    description: z.string().optional().describe("New event description"),
    location: z.string().optional().describe("New event location"),
    people: z.array(z.string()).optional().describe("New list of attendee emails"),
    calendarId: z.string().optional().describe("New calendar ID"),
    allDay: z.boolean().optional().describe("New all-day flag"),
  });

  metadata = { category: "calendar" };

  protected async _call(input: z.infer<this["schema"]>) {
    try {
      const { eventId, ...updates } = input;
      const updated = await calendarClient.update(eventId, updates);
      return updated || "Event not found";
    } catch (error) {
      return `Error updating calendar event: ${(error as Error).message}`;
    }
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('calendar_update', async () => new CalendarUpdateTool(), 'calendar');
