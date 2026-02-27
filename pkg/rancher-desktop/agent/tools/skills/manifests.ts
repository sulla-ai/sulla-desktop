import type { ToolManifest } from '../registry';

export const skillsToolManifests: ToolManifest[] = [
  {
    name: 'search_skills',
    description: 'Search available skills by description or tag. ALWAYS call this first for any non-trivial or repeatable task.',
    category: 'meta',
    schemaDef: {
      query: { type: 'string', description: 'Search query — keywords to match against skill names, descriptions, and tags.' },
    },
    operationTypes: ['read'],
    loader: () => import('./search_skills'),
  },
  {
    name: 'load_skill',
    description: 'Load the FULL detailed instructions for a skill. Call after search_skills confirms relevance.',
    category: 'skills',
    schemaDef: {
      skill_name: { type: 'string', description: 'The folder name of the skill to load.' },
    },
    operationTypes: ['read'],
    loader: () => import('./load_skill'),
  },
  {
    name: 'create_skill',
    description: 'Create or update a new skill folder + SKILL.md. Use after your game plan is approved.',
    category: 'skills',
    schemaDef: {
      skill_name: { type: 'string', description: 'The folder name for the skill (used as identifier).' },
      content: { type: 'string', description: 'Full SKILL.md content including YAML frontmatter and markdown body.' },
    },
    operationTypes: ['create'],
    loader: () => import('./create_skill'),
  },
];
