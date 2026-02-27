import path from 'path';
import { resolveSullaWorkspacesDir } from '../../utils/sullaPaths';

export function resolveWorkspaceRoot(): string {
  return resolveSullaWorkspacesDir();
}

export function resolveWorkspacePath(name: string): string {
  return path.join(resolveWorkspaceRoot(), name);
}
