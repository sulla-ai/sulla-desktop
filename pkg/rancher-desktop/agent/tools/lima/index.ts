// Import all lima tool registrations
import { limaCreateRegistration } from './lima_create';
import { limaDeleteRegistration } from './lima_delete';
import { limaListRegistration } from './lima_list';
import { limaShellRegistration } from './lima_shell';
import { limaStartRegistration } from './lima_start';
import { limaStopRegistration } from './lima_stop';

// Export all lima tool registrations as an array
export const limaToolRegistrations = [
  limaCreateRegistration,
  limaDeleteRegistration,
  limaListRegistration,
  limaShellRegistration,
  limaStartRegistration,
  limaStopRegistration,
];
