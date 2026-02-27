import type { ToolManifest } from '../registry';

export const browserToolManifests: ToolManifest[] = [
  {
    name: 'brave_search',
    description: 'Search the web using Brave Search API for current and comprehensive results.',
    category: 'browser',
    schemaDef: {
    query: { type: 'string', description: "The search query to execute" },
    count: { type: 'number', optional: true, default: 10, description: "Number of search results to return (max 20)" },
  },
    operationTypes: ['read'],
    loader: () => import('./brave_search'),
  },
  {
    name: 'duckduckgo_search',
    description: 'Search the web using DuckDuckGo for privacy-focused and comprehensive results.',
    category: 'browser',
    schemaDef: {
    query: { type: 'string', description: "The search query to execute" },
    maxResults: { type: 'number', optional: true, default: 10, description: "Maximum number of search results to return" },
  },
    operationTypes: ['read'],
    loader: () => import('./duckduckgo_search'),
  },
];
