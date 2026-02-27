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
  {
    name: 'create_project',
    description: 'Create a new project folder with PROJECT.md (PRD) and scaffold README.md. The project_name becomes the folder name.',
    category: 'projects',
    schemaDef: {
      project_name: { type: 'string', description: 'The folder name / slug for the project (kebab-case recommended).' },
      content: { type: 'string', description: 'Full PROJECT.md content including YAML frontmatter and markdown body.' },
    },
    operationTypes: ['create'],
    loader: () => import('./create_project'),
  },
  {
    name: 'update_project',
    description: 'Overwrite the entire PROJECT.md for an existing project. Use patch_project for partial updates.',
    category: 'projects',
    schemaDef: {
      project_name: { type: 'string', description: 'The slug or folder name of the project to update.' },
      content: { type: 'string', description: 'Full replacement PROJECT.md content including YAML frontmatter and markdown body.' },
    },
    operationTypes: ['update'],
    loader: () => import('./update_project'),
  },
  {
    name: 'patch_project',
    description: 'Update a specific markdown section of a PROJECT.md without rewriting the entire file. Specify a heading name and new content for that section.',
    category: 'projects',
    schemaDef: {
      project_name: { type: 'string', description: 'The slug or folder name of the project to patch.' },
      section: { type: 'string', description: 'The markdown heading name to replace (e.g. "Execution Checklist", "Must Haves").' },
      content: { type: 'string', description: 'New content for the specified section (replaces everything under that heading until the next heading).' },
    },
    operationTypes: ['update'],
    loader: () => import('./patch_project'),
  },
  {
    name: 'delete_project',
    description: 'Delete a project folder and remove it from the registry.',
    category: 'projects',
    schemaDef: {
      project_name: { type: 'string', description: 'The slug or folder name of the project to delete.' },
    },
    operationTypes: ['delete'],
    loader: () => import('./delete_project'),
  },
];
