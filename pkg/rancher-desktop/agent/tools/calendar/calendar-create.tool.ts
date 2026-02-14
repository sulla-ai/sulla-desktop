import { BaseTool } from "../base";
import { z } from "zod";
import { calendarClient } from "../../services/CalendarClient";

export class CalendarCreateTool extends BaseTool {
  name = "calendar_create";
  description = "Create a new calendar event or reminder.";
  schema = z.object({
    title: z.string().describe("Event title"),
    start: z.string().describe("Start time in ISO format"),
    end: z.string().describe("End time in ISO format"),
    description: z.string().optional().describe("Event description"),
    location: z.string().optional().describe("Event location"),
    people: z.array(z.string()).optional().describe("List of attendee emails"),
    calendarId: z.string().optional().describe("Calendar ID"),
    allDay: z.boolean().optional().describe("Whether this is an all-day event"),
  });

  metadata = { category: "calendar" };

  protected async _call(input: z.infer<this["schema"]>) {
    try {
      const event = await calendarClient.create(input);
      return event;
    } catch (error) {
      return `Error creating calendar event: ${(error as Error).message}`;
    }
  }
}
