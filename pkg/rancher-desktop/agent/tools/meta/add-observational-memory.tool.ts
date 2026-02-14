import { BaseTool } from "../base";
import { z } from "zod";
import { SullaSettingsModel } from '../../database/models/SullaSettingsModel';
import { parseJson } from '../../services/JsonParseService';

// Generate a 4-character random ID using lowercase, uppercase, and numbers
function generateTinyId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 4; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export class AddObservationalMemoryTool extends BaseTool {
  name = "add_observational_memory";
  description = `Use this tool to store the observations you make into long-term memory.`;

  schema = z.object({
    priority: z.enum(["🔴", "🟡", "⚪"]).default("🟡"),
    content: z.string().describe("One sentence only — extremely concise, always include the context"),
  });

  metadata = { category: "meta" };

  protected async _call(input: z.infer<this["schema"]>) {
    // Get current observational memories
    const observationalMemory = await SullaSettingsModel.get('observationalMemory', []);
    let memoryArray: any[] = [];

    try {
      const parsed = parseJson(observationalMemory);
      if (Array.isArray(parsed)) {
        memoryArray = parsed;
      } else {
        memoryArray = [];
      }
    } catch (e) {
      console.error('Failed to parse observational memory:', e);
      memoryArray = [];
    }

    // Generate timestamp in YYYY-MM-DD HH:MM format
    const now = new Date();
    const timestamp = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0');

    // Append new memory entry
    memoryArray.push({
      id: generateTinyId(),
      priority: input.priority,
      timestamp: timestamp,
      content: input.content,
    });

    // Save back to settings
    await SullaSettingsModel.set('observationalMemory', memoryArray);

    return { success: true, stored: input.content };
  }
}