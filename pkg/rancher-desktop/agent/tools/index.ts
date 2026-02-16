// src/tools/index.ts
import { toolRegistry } from './registry';

// Import all tool registration arrays from categories
import { metaToolRegistrations } from './meta';
import { browserToolRegistrations } from './browser';
import { calendarToolRegistrations } from './calendar';
import { dockerToolRegistrations } from './docker';
import { githubToolRegistrations } from './github';
import { kubectlToolRegistrations } from './kubectl';
import { limaToolRegistrations } from './lima';
import { memoryToolRegistrations } from './memory';
import { n8nToolRegistrations } from './n8n';
import { pgToolRegistrations } from './pg';
import { rdctlToolRegistrations } from './rdctl';
import { redisToolRegistrations } from './redis';
import { slackToolRegistrations } from './slack';
import { workspaceToolRegistrations } from './workspace';

// Combine all registrations and register them
const allRegistrations = [
  ...metaToolRegistrations,
  ...browserToolRegistrations,
  ...calendarToolRegistrations,
  ...dockerToolRegistrations,
  ...githubToolRegistrations,
  ...kubectlToolRegistrations,
  ...limaToolRegistrations,
  ...memoryToolRegistrations,
  ...n8nToolRegistrations,
  ...pgToolRegistrations,
  ...rdctlToolRegistrations,
  ...redisToolRegistrations,
  ...slackToolRegistrations,
  ...workspaceToolRegistrations,
];

// Convert ToolRegistration[] to ToolEntry[] by adding loaders
const allEntries = allRegistrations.map(reg => ({
  name: reg.name,
  description: reg.description,
  category: reg.category,
  loader: async () => {
    const instance = new reg.workerClass();
    instance.schemaDef = reg.schemaDef;
    instance.name = reg.name;
    instance.description = reg.description;
    instance.metadata.category = reg.category;
    return instance;
  },
}));

// Register all tools with the registry
toolRegistry.registerAll(allEntries);

// Export convenience helpers (now async!)
export const getTool = (name: string) => toolRegistry.getTool(name);
export const getToolsByCategory = (cat: string) => toolRegistry.getToolsByCategory(cat);

// Primary tools export - meta category only
export const tools = toolRegistry.getLLMToolsForCategory("meta");

// For LangGraph agents – returns a function that loads on demand for all tools
export const createAgentTools = toolRegistry.getAllLLMTools();

// Export the registry itself for direct access
export { toolRegistry };
