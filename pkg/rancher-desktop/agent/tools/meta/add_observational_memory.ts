import { BaseTool, ToolRegistration } from "../base";
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

/**
 * Add Observational Memory Tool - Worker class for execution
 */
export class AddObservationalMemoryWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  
  protected async _validatedCall(input: any) {
    const { priority, content } = input;

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

    // Add new memory
    const newMemory = {
      id: generateTinyId(),
      priority,
      content,
      timestamp: new Date().toISOString(),
    };

    memoryArray.push(newMemory);

    // Keep only the most recent 50 memories
    if (memoryArray.length > 50) {
      memoryArray = memoryArray.slice(-50);
    }

    // Save back to settings
    await SullaSettingsModel.set('observationalMemory', JSON.stringify(memoryArray));

    return {
      success: true,
      id: newMemory.id,
      totalMemories: memoryArray.length,
      message: `Observation stored with ID: ${newMemory.id}`,
    };
  }
}

// Export the complete tool registration with type enforcement
export const addObservationalMemoryRegistration: ToolRegistration = {
  name: "add_observational_memory",
  description: "Use this tool to store the observations you make into long-term memory.",
  category: "meta",
  schemaDef: {
    priority: { type: 'enum' as const, enum: ["🔴", "🟡", "⚪"], default: "🟡" },
    content: { type: 'string' as const, description: "One sentence only — extremely concise, always include the context" },
  },
  workerClass: AddObservationalMemoryWorker,
};
