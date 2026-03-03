import type { ToolManifest } from '../registry';

export const projectsToolManifests: ToolManifest[] = [
  {
    name: 'search_projects',
    description: 'Search available projects by name, description, status, or tag. Use this to discover existing projects before creating new ones.',
    category: 'meta',
    schemaDef: {
      query: { type: 'string', description: 'Search query — keywords to match against project names, descriptions, statuses, and tags.' },
    },
    operationTypes: ['read'],
    loader: () => import('./search_projects'),
  },
  {
    name: 'load_project',
    description: 'Load the FULL PROJECT.md content (PRD) for a project. Call after search_projects confirms relevance.',
    category: 'projects',
    schemaDef: {
      project_name: { type: 'string', description: 'The slug or folder name of the project to load.' },
    },
    operationTypes: ['read'],
    loader: () => import('./load_project'),
  },
];
