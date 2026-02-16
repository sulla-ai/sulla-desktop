// Import all kubectl tool registrations
import { kubectlApplyRegistration } from './kubectl_apply';
import { kubectlDeleteRegistration } from './kubectl_delete';
import { kubectlDescribeRegistration } from './kubectl_describe';

// Export all kubectl tool registrations as an array
export const kubectlToolRegistrations = [
  kubectlApplyRegistration,
  kubectlDeleteRegistration,
  kubectlDescribeRegistration,
];
