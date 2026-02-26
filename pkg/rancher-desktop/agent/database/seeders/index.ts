// seeders/index.ts
// Central registry for all seeders
// DatabaseManager imports this to run tracked seeders

import { initialize as knowledgeBaseSeeder } from './KnowledgeBaseSeeder';  // adjust path if needed
import { initialize as knowledgeBaseSectionsSeeder } from './KnowledgeBaseSectionsSeeder';
import { initialize as n8nUserSeeder } from './N8nUserSeeder';
import { initialize as n8nSettingsSeeder } from './N8nSettingsSeeder';

// Add future seeders here in the same way
// import { initialize as someOtherSeeder } from './some-other-seeder';

export const seedersRegistry = [
  {
    name: 'knowledgebase-seeder-v4',
    run: knowledgeBaseSeeder,
  },
  {
    name: 'knowledgebase-sections-seeder',
    run: knowledgeBaseSectionsSeeder,
  },
  {
    name: 'n8n-user-seeder',
    run: n8nUserSeeder,
  },
  {
    name: 'n8n-settings-seeder',
    run: n8nSettingsSeeder,
  },
  // {
  //   name: 'core-data-seed',
  //   run: coreDataSeeder,
  // },
] as const;