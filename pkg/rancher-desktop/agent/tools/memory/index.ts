// Import all memory tool registrations
import { articleFindRegistration } from './article_find';
import { articleCreateRegistration } from './article_create';
import { articleDeleteRegistration } from './article_delete';
import { articleFindRelatedRegistration } from './article_find_related';
import { articleListRegistration } from './article_list';
import { articleRelatedRegistration } from './article_related';
import { articleSearchRegistration } from './article_search';
import { articleUpdateRegistration } from './article_update';

// Export all memory tool registrations as an array
export const memoryToolRegistrations = [
  articleFindRegistration,
  articleCreateRegistration,
  articleDeleteRegistration,
  articleFindRelatedRegistration,
  articleListRegistration,
  articleRelatedRegistration,
  articleSearchRegistration,
  articleUpdateRegistration,
];
