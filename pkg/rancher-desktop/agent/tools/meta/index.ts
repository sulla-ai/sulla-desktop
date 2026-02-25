// Import all meta tool registrations
import { addObservationalMemoryRegistration } from './add_observational_memory';
import { browseToolsRegistration } from './browse_tools';
import { execRegistration } from './exec';
import { removeObservationalMemoryRegistration } from './remove_observational_memory';

// Export all meta tool registrations as an array
export const metaToolRegistrations = [
  addObservationalMemoryRegistration,
  browseToolsRegistration,
  execRegistration,
  removeObservationalMemoryRegistration,
];
