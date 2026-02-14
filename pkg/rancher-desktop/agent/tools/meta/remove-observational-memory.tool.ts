import { BaseTool } from "../base";
import { z } from "zod";
import { SullaSettingsModel } from '../../database/models/SullaSettingsModel';
import { parseJson } from '../../services/JsonParseService';

export class RemoveObservationalMemoryTool extends BaseTool {
  name = "remove_observational_memory";
  description = `Remove a specific observational memory by its ID to delete it from long-term memory.`;

  schema = z.object({
    id: z.string().describe("The 4-character ID of the memory to remove."),
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

    // Filter out the memory with the matching ID
    const initialLength = memoryArray.length;
    memoryArray = memoryArray.filter((memory: any) => memory.id !== input.id);
    const removedCount = initialLength - memoryArray.length;

    // Save back to settings
    await SullaSettingsModel.set('observationalMemory', memoryArray);

    return { success: true, removed: removedCount };
  }
}
