// src/tools/index.ts
import { toolRegistry } from './registry';
import type { ToolRegistration } from './base';

// Import all tool registration arrays from categories
import { metaToolRegistrations } from './meta';
import { browserToolRegistrations } from './browser';
import { calendarToolRegistrations } from './calendar';
import { dockerToolRegistrations } from './docker';
import { fsToolRegistrations } from './fs';
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
import { integrationToolRegistrations } from './integrations';
import { playwrightToolRegistrations } from './playwright';

// Combine all registrations and register them
const allRegistrationsRaw: ToolRegistration[] = [
  ...metaToolRegistrations,
  ...browserToolRegistrations,
  ...calendarToolRegistrations,
  ...dockerToolRegistrations,
  ...fsToolRegistrations,
  ...githubToolRegistrations,
  ...integrationToolRegistrations,
  ...kubectlToolRegistrations,
  ...limaToolRegistrations,
  ...memoryToolRegistrations,
  ...n8nToolRegistrations,
  ...pgToolRegistrations,
  ...rdctlToolRegistrations,
  ...redisToolRegistrations,
  ...slackToolRegistrations,
  ...workspaceToolRegistrations,
  ...playwrightToolRegistrations,
];

// Register all tools with the registry
toolRegistry.registerAllRegistrations(allRegistrationsRaw);

// Export convenience helpers (now async!)
export const getTool = (name: string) => toolRegistry.getTool(name);
export const getToolsByCategory = (cat: string) => toolRegistry.getToolsByCategory(cat);

// Primary tools export - meta category only
export const tools = toolRegistry.getLLMToolsForCategory("meta");

// For LangGraph agents – returns a function that loads on demand for all tools
export const createAgentTools = toolRegistry.getAllLLMTools();

// Export the registry itself for direct access
export { toolRegistry };
