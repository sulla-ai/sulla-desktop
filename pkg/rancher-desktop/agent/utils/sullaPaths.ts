import os from 'node:os';
import path from 'node:path';

const SULLA_HOME_DIR_ENV = 'SULLA_HOME_DIR';
const SULLA_PROJECTS_DIR_ENV = 'SULLA_PROJECTS_DIR';
const SULLA_SKILLS_DIR_ENV = 'SULLA_SKILLS_DIR';
const SULLA_WORKSPACES_DIR_ENV = 'SULLA_WORKSPACES_DIR';

export function resolveSullaHomeDir(): string {
  const envPath = String(process.env[SULLA_HOME_DIR_ENV] || '').trim();
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(envPath);
  }

  return path.join(os.homedir(), 'sulla');
}

export function resolveSullaProjectsDir(): string {
  const envPath = String(process.env[SULLA_PROJECTS_DIR_ENV] || '').trim();
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(envPath);
  }

  return path.join(resolveSullaHomeDir(), 'projects');
}

export function resolveSullaSkillsDir(): string {
  const envPath = String(process.env[SULLA_SKILLS_DIR_ENV] || '').trim();
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(envPath);
  }

  return path.join(resolveSullaHomeDir(), 'skills');
}

export function resolveSullaWorkspacesDir(): string {
  const envPath = String(process.env[SULLA_WORKSPACES_DIR_ENV] || '').trim();
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(envPath);
  }

  return path.join(resolveSullaHomeDir(), 'workspaces');
}
