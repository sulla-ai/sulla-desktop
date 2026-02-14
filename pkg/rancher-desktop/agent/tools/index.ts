// src/tools/index.ts
import { toolRegistry } from "./registry";

// Import all your tools here (this is the only place you need to add new ones)
import { AddObservationalMemoryTool } from "./meta/add-observational-memory.tool";
import { BrowseToolsTool } from "./meta/browse-tools.tool";
import { CreatePlanTool } from "./meta/create-plan.tool";
import { InstallSkillTool } from "./meta/install-skill.tool";
import { RemoveObservationalMemoryTool } from "./meta/remove-observational-memory.tool";
import { SetActionTool } from "./meta/set-action.tool";

// Register everything
toolRegistry.registerMany([
  new AddObservationalMemoryTool(),
  new BrowseToolsTool(),
  new CreatePlanTool(),
  new InstallSkillTool(),
  new RemoveObservationalMemoryTool(),
  new SetActionTool(),
  // ... add more
]);

// Export everything you need in the rest of your app
export const tools = toolRegistry.getLLMTools();
export const { getToolsByCategory, getCategories } = toolRegistry;

// Convenience for LangGraph agents
export const createAgentTools = () => toolRegistry.getAllTools();