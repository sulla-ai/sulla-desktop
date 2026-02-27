import os from 'os';
import path from 'path';

const WORKSPACES_DIR_ENV = 'SULLA_WORKSPACES_DIR';

export function resolveWorkspaceRoot(): string {
  const envPath = String(process.env[WORKSPACES_DIR_ENV] || '').trim();
  if (envPath) {
    return path.isAbsolute(envPath)
      ? envPath
      : path.resolve(envPath);
  }

  // Default to the user's mounted home directory so workspace paths are
  // directly usable by tools, Docker mounts, and host-side file operations.
  return path.join(os.homedir(), 'sulla', 'workspaces');
}

export function resolveWorkspacePath(name: string): string {
  return path.join(resolveWorkspaceRoot(), name);
}
