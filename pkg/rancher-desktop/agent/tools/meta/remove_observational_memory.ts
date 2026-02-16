import { BaseTool, ToolRegistration } from "../base";
import { SullaSettingsModel } from '../../database/models/SullaSettingsModel';
import { parseJson } from '../../services/JsonParseService';

/**
 * Remove Observational Memory Tool - Worker class for execution
 */
export class RemoveObservationalMemoryWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { id } = input;

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

    // Find and remove the memory
    const index = memoryArray.findIndex((mem: any) => mem.id === id);
    if (index === -1) {
      return {
        success: false,
        error: `Memory with ID "${id}" not found.`,
      };
    }

    const removedMemory = memoryArray.splice(index, 1)[0];

    // Save back to settings
    await SullaSettingsModel.set('observationalMemory', JSON.stringify(memoryArray));

    return {
      success: true,
      removedId: id,
      totalMemories: memoryArray.length,
      message: `Memory removed: "${removedMemory.content}"`,
    };
  }
}

// Export the complete tool registration with type enforcement
export const removeObservationalMemoryRegistration: ToolRegistration = {
  name: "remove_observational_memory",
  description: "Remove a specific observational memory by its ID to delete it from long-term memory.",
  category: "meta",
  schemaDef: {
    id: { type: 'string' as const, description: "The 4-character ID of the memory to remove." },
  },
  workerClass: RemoveObservationalMemoryWorker,
};
