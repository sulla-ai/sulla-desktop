// Import all meta tool registrations
import { addObservationalMemoryRegistration } from './add_observational_memory';
import { browseToolsRegistration } from './browse_tools';
import { createPlanRegistration } from './create_plan';
import { execRegistration } from './exec';
import { removeObservationalMemoryRegistration } from './remove_observational_memory';
import { setActionRegistration } from './set_action';
import { triggerSubgraphRegistration } from './trigger_subgraph';
import { updatePlanRegistration } from './update_plan';

// Export all meta tool registrations as an array
export const metaToolRegistrations = [
  addObservationalMemoryRegistration,
  browseToolsRegistration,
  createPlanRegistration,
  execRegistration,
  removeObservationalMemoryRegistration,
  setActionRegistration,
  triggerSubgraphRegistration,
  updatePlanRegistration,
];
