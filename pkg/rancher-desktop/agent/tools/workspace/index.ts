// Import all workspace tool registrations
import { createWorkspaceRegistration } from './create_workspace';
import { deleteWorkspaceRegistration } from './delete_workspace';
import { getWorkspacePathRegistration } from './get_workspace_path';
import { viewWorkspaceFilesRegistration } from './view_workspace_files';

// Export all workspace tool registrations as an array
export const workspaceToolRegistrations = [
  createWorkspaceRegistration,
  deleteWorkspaceRegistration,
  getWorkspacePathRegistration,
  viewWorkspaceFilesRegistration,
];
