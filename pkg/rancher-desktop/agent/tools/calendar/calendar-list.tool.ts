import { BaseTool } from "../base";
import { z } from "zod";
import { calendarClient } from "../../services/CalendarClient";

export class CalendarListTool extends BaseTool {
  name = "calendar_list";
  description = "List calendar events within a date range.";
  schema = z.object({
    startAfter: z.string().optional().describe("Start date filter in ISO format"),
    endBefore: z.string().optional().describe("End date filter in ISO format"),
    calendarId: z.string().optional().describe("Calendar ID filter"),
  });

  metadata = { category: "calendar" };

  protected async _call(input: z.infer<this["schema"]>) {
    try {
      const events = await calendarClient.getEvents(input);
      return events;
    } catch (error) {
      return `Error listing calendar events: ${(error as Error).message}`;
    }
  }
}
