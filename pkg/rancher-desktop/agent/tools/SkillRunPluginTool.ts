import fs from 'fs';
import path from 'path';

import type { ThreadState, ToolResult } from '../types';
import { getPersistenceService } from '../services/PersistenceService';
import paths from '@pkg/utils/paths';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

function getPackagedResourcesRoot(): string | null {
  const candidates = [
    path.join(process.resourcesPath || '', 'resources'),
    path.join(process.cwd(), 'resources'),
  ].filter(Boolean);

  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) {
        return c;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export class SkillRunPluginTool extends BaseTool {
  override readonly name = 'skill_run_plugin';
  override readonly category = 'skills';

  override getPlanningInstructions(): string {
    return [
      '34) skill_run_plugin (Skills)',
      '   - Purpose: Run an enabled skill plugin bash entrypoint from the installed skills directory.',
      '   - Args:',
      '     - skillId (string, required)',
      '     - timeoutSeconds (number, optional, default 20)',
      '   - Output: stdout/stderr/exitCode.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const skillId = String(context.args?.skillId || '');
    const timeoutSeconds = Number(context.args?.timeoutSeconds ?? 20);

    if (!skillId) {
      return { toolName: this.name, success: false, error: 'Missing args: skillId' };
    }

    const persistence = getPersistenceService();
    await persistence.initialize();

    const enabledSkill = await persistence.getEnabledSkill(skillId);
    if (!enabledSkill) {
      return { toolName: this.name, success: false, error: `Skill is not enabled: ${ skillId }` };
    }

    const meta = enabledSkill.meta as {
      metaSource?: 'builtin' | 'userData' | 'remote';
      metaPath?: string;
      entrypoint?: string;
    };

    let installDir: string | null = null;
    let metaPath: string | null = null;

    if (meta.metaSource === 'builtin' && meta.metaPath) {
      const root = getPackagedResourcesRoot();
      if (root) {
        const skillDir = path.dirname(path.join(root, meta.metaPath));
        if (fs.existsSync(skillDir)) {
          installDir = skillDir;
          metaPath = path.join(root, meta.metaPath);
        }
      }
    } else if (meta.metaSource === 'userData') {
      const userDir = path.join(paths.appHome, 'skills', 'installed', skillId);
      if (fs.existsSync(userDir)) {
        installDir = userDir;
        metaPath = path.join(installDir, 'meta.json');
      }
    }

    if (!installDir) {
      const userInstallDir = path.join(paths.appHome, 'skills', 'installed', skillId);
      if (fs.existsSync(userInstallDir)) {
        installDir = userInstallDir;
        metaPath = path.join(installDir, 'meta.json');
      } else {
        const root = getPackagedResourcesRoot();
        if (root) {
          const builtinDir = path.join(root, 'skills', 'installed', skillId);
          if (fs.existsSync(builtinDir)) {
            installDir = builtinDir;
            metaPath = path.join(installDir, 'meta.json');
          }
        }
      }
    }

    if (!installDir) {
      return { toolName: this.name, success: false, error: `Skill is not installed: ${ skillId }` };
    }

    let entrypoint = meta.entrypoint || 'run.sh';

    try {
      if (metaPath && fs.existsSync(metaPath)) {
        const raw = fs.readFileSync(metaPath, 'utf-8');
        const fileMeta = JSON.parse(raw) as { entrypoint?: unknown };
        if (typeof fileMeta.entrypoint === 'string' && fileMeta.entrypoint.trim().length > 0) {
          entrypoint = fileMeta.entrypoint.trim();
        }
      }
    } catch {
      // ignore, fall back to run.sh
    }

    const entryPath = path.join(installDir, entrypoint);
    if (!fs.existsSync(entryPath)) {
      return { toolName: this.name, success: false, error: `Skill entrypoint not found: ${ entryPath }` };
    }

    const res = await runCommand('bash', [entryPath], {
      timeoutMs: (Number.isFinite(timeoutSeconds) ? timeoutSeconds : 20) * 1000,
      maxOutputChars: 200_000,
    });

    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'skill command failed' };
    }

    return {
      toolName: this.name,
      success: true,
      result: {
        skillId,
        installDir,
        entrypoint,
        stdout: res.stdout,
        stderr: res.stderr || undefined,
        exitCode: res.exitCode,
      },
    };
  }
}
