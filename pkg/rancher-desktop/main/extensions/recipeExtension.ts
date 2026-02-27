import fs from 'fs';
import path from 'path';

import Electron from 'electron';
import yaml from 'yaml';

import { ExtensionErrorImpl } from './extensions';
import { fetchMarketplaceData, MarketplaceEntry } from './marketplaceData';
import type { InstallationManifest } from './recipeTypes';
import {
  Extension, ExtensionErrorCode, ExtensionMetadata,
} from './types';

import { SullaSettingsModel } from '@pkg/agent/database/models/SullaSettingsModel';
import { getIntegrationService } from '@pkg/agent/services/IntegrationService';
import mainEvents from '@pkg/main/mainEvents';
import { spawnFile } from '@pkg/utils/childProcess';
import Logging from '@pkg/utils/logging';
import paths from '@pkg/utils/paths';
import { sullaLog } from '@pkg/utils/sullaLog';

const console = Logging.extensions;

/**
 * RecipeExtensionImpl implements the Extension interface for recipe-based
 * extensions that are driven by a remote installation.yaml file rather than
 * a Docker image with baked-in metadata.
 *
 * Install flow:
 *   1. Fetch installation.yaml from the `installable` URL in the marketplace catalog
 *   2. Download all recipe assets (icon, compose files, etc.) from the recipe folder
 *   3. Store everything in the local extension directory (APP_DIR)
 *   4. Run setup commands from installation.yaml in order
 *   5. Mark installed
 *
 * Runtime:
 *   - start/stop/restart/status/update/logs commands are read from installation.yaml
 *   - ${APP_DIR} = extension directory, ${COMPOSE_FILE} = full path to compose file
 *   - The system is intentionally dumb — it just runs whatever commands the yaml says
 */
export class RecipeExtensionImpl implements Extension {
  constructor(
    slug: string,
    version: string,
    private readonly catalogEntry: MarketplaceEntry,
  ) {
    this.id = slug;
    this.version = version;
    // dir is set after manifest is fetched — use extensionRoot/<manifest.id>
    // For now, derive a safe name from the slug (last segment)
    const safeName = slug.replace(/[/:]/g, '-').replace(/^-+|-+$/g, '');

    this._dirFallback = path.join(paths.extensionRoot, safeName);
  }

  readonly id:      string;
  readonly version: string;

  /** Fallback dir derived from slug; replaced once manifest.id is known. */
  private _dirFallback: string;
  private _dirOverride: string | undefined;

  /** The extension directory inside extensionRoot, named after manifest.id. */
  get dir(): string {
    return this._dirOverride ?? this._dirFallback;
  }

  protected _metadata:  Promise<ExtensionMetadata> | undefined;
  protected _labels:    Promise<Record<string, string>> | undefined;
  protected _manifest:  InstallationManifest | undefined;

  protected readonly MANIFEST_FILE = 'installation.yaml';
  protected readonly VERSION_FILE  = 'version.txt';

  get image(): string {
    return `${ this.id }:${ this.version }`;
  }

  // ─── Metadata ───────────────────────────────────────────────────────

  get metadata(): Promise<ExtensionMetadata> {
    this._metadata ??= (async() => {
      const icon = this.catalogEntry.logo
        || this.catalogEntry.labels?.['com.docker.desktop.extension.icon']
        || this.catalogEntry.labels?.['com.docker.extension.icon']
        || '';

      if (!icon) {
        throw new ExtensionErrorImpl(
          ExtensionErrorCode.INVALID_METADATA,
          `Recipe extension ${ this.id } has no icon in catalog`,
        );
      }

      return { icon } as ExtensionMetadata;
    })();

    return this._metadata;
  }

  get labels(): Promise<Record<string, string>> {
    this._labels ??= Promise.resolve(this.catalogEntry.labels ?? {});

    return this._labels;
  }

  get extraUrls(): Promise<Array<{ label: string; url: string }>> {
    return (async() => {
      const manifest = await this.getManifest();

      return manifest.extraUrls ?? [];
    })();
  }

  // ─── Manifest ───────────────────────────────────────────────────────

  async getManifest(): Promise<InstallationManifest> {
    if (this._manifest) {
      return this._manifest;
    }

    // Try local first (already installed)
    const localPath = path.join(this.dir, this.MANIFEST_FILE);

    try {
      const raw = await fs.promises.readFile(localPath, 'utf-8');

      this._manifest = yaml.parse(raw) as InstallationManifest;

      return this._manifest;
    } catch { /* not installed locally, fetch remote */ }

    // Fetch from remote
    const installableUrl = this.catalogEntry.installable;

    if (!installableUrl) {
      throw new ExtensionErrorImpl(
        ExtensionErrorCode.INVALID_METADATA,
        `No installable URL for recipe extension ${ this.id }`,
      );
    }

    const response = await fetch(installableUrl);

    if (!response.ok) {
      throw new ExtensionErrorImpl(
        ExtensionErrorCode.FILE_NOT_FOUND,
        `Failed to fetch installation.yaml for ${ this.id }: ${ response.status }`,
      );
    }

    const text = await response.text();

    this._manifest = yaml.parse(text) as InstallationManifest;

    return this._manifest;
  }

  // ─── Install ────────────────────────────────────────────────────────

  async install(_allowedImages: readonly string[] | undefined): Promise<boolean> {
    if (await this.isInstalled()) {
      console.debug(`Recipe extension ${ this.id } already installed.`);

      return false;
    }

    // ── Phase 1: Fetch the installable manifest ──
    const manifest = await this.getManifest();

    // Now that we have the manifest, set the real dir using manifest.id
    this._dirOverride = path.join(paths.extensionRoot, manifest.id);

    sullaLog({
      topic: 'extensions', level: 'info',
      message: `Installing recipe extension ${ this.id } (${ manifest.name })`,
      data:    { dir: this.dir, manifestId: manifest.id },
    });

    // Clean up any leftover directory from a previous failed install
    try {
      await fs.promises.rm(this.dir, { recursive: true, maxRetries: 3 });
    } catch (ex: any) {
      if ((ex as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.debug(`Could not clean stale dir ${ this.dir }: ${ ex }`);
      }
    }

    // ── Phase 2: Create the extension folder and pull recipe assets ──
    await fs.promises.mkdir(this.dir, { recursive: true });

    try {
      // Save the installation manifest locally
      await this.saveManifest(manifest);

      // Pull all recipe assets (icon, manifest.yaml, etc.) from the remote recipe folder
      await this.pullRecipeAssets();

      // Save labels from catalog
      await fs.promises.writeFile(
        path.join(this.dir, 'labels.json'),
        JSON.stringify(await this.labels, undefined, 2),
      );

      sullaLog({ topic: 'extensions', level: 'info', message: `Recipe assets saved to ${ this.dir }` });

      // ── Phase 2b: Resolve {{variables}} in the compose file and write .env ──
      await this.processComposeFile();
      await this.writeEnvFile();

      // ── Phase 3: Process the installable file (setup steps) ──
      await this.runSetup(manifest);

      // ── Phase 4: Mark installed ──
      await fs.promises.writeFile(
        path.join(this.dir, this.VERSION_FILE),
        this.version,
        'utf-8',
      );
    } catch (ex) {
      sullaLog({ topic: 'extensions', level: 'error', message: `Failed to install recipe extension ${ this.id }, cleaning up`, error: ex });
      await fs.promises.rm(this.dir, { recursive: true, maxRetries: 3 }).catch((e) => {
        sullaLog({ topic: 'extensions', level: 'error', message: `Failed to cleanup extension directory ${ this.dir }`, error: e });
      });
      throw ex;
    }

    mainEvents.emit('settings-write', {
      application: { extensions: { installed: { [this.id]: this.version } } },
    });

    // Clear the default session cache so updated icons are loaded fresh
    Electron.session.defaultSession.clearCache();

    sullaLog({ topic: 'extensions', level: 'info', message: `Recipe extension ${ this.id } installed successfully.` });

    // Start the extension after install
    try {
      await this.start();
    } catch (ex) {
      sullaLog({ topic: 'extensions', level: 'error', message: `Failed to start ${ this.id } after install`, error: ex });
    }

    return true;
  }

  protected async saveManifest(manifest: InstallationManifest): Promise<void> {
    await fs.promises.writeFile(
      path.join(this.dir, this.MANIFEST_FILE),
      yaml.stringify(manifest),
      'utf-8',
    );
  }

  /**
   * Pull all assets from the remote recipe folder into the local extension dir.
   * Uses the GitHub Contents API to list files, then downloads each one.
   */
  protected async pullRecipeAssets(): Promise<void> {
    const installableUrl = this.catalogEntry.installable;

    if (!installableUrl) {
      return;
    }

    // Derive the GitHub Contents API URL for the recipe folder.
    // installableUrl looks like:
    //   https://raw.githubusercontent.com/<owner>/<repo>/refs/heads/<branch>/recipes/<name>/installation.yaml
    // We need:
    //   https://api.github.com/repos/<owner>/<repo>/contents/recipes/<name>
    const rawMatch = installableUrl.match(
      /raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/.+?\/(recipes\/[^/]+)\/[^/]+$/,
    );

    if (!rawMatch) {
      // Fallback: just download the icon from the base URL
      sullaLog({ topic: 'extensions', level: 'debug', message: `Could not parse recipe folder URL from ${ installableUrl }, skipping asset pull` });
      await this.downloadIconFallback();

      return;
    }

    const [, owner, repo, recipePath] = rawMatch;
    const contentsUrl = `https://api.github.com/repos/${ owner }/${ repo }/contents/${ recipePath }`;

    sullaLog({ topic: 'extensions', level: 'info', message: `Fetching recipe assets from ${ contentsUrl }` });

    try {
      const response = await fetch(contentsUrl);

      if (!response.ok) {
        sullaLog({ topic: 'extensions', level: 'warn', message: `GitHub Contents API returned ${ response.status } for ${ contentsUrl }` });
        await this.downloadIconFallback();

        return;
      }

      const items: Array<{ name: string; download_url: string | null; type: string }> = await response.json() as any;

      for (const item of items) {
        // Skip directories and files without download URLs; skip installation.yaml (already saved)
        if (item.type !== 'file' || !item.download_url || item.name === 'installation.yaml') {
          continue;
        }

        sullaLog({ topic: 'extensions', level: 'debug', message: `Downloading recipe asset: ${ item.name }` });

        try {
          const fileResp = await fetch(item.download_url);

          if (fileResp.ok) {
            const data = Buffer.from(await fileResp.arrayBuffer());

            await fs.promises.writeFile(path.join(this.dir, item.name), data);
          }
        } catch (dlErr) {
          sullaLog({ topic: 'extensions', level: 'warn', message: `Failed to download ${ item.name }`, error: dlErr });
        }
      }
    } catch (ex) {
      sullaLog({ topic: 'extensions', level: 'warn', message: `Failed to pull recipe assets from ${ contentsUrl }`, error: ex });
      await this.downloadIconFallback();
    }
  }

  /**
   * Fallback icon download when the GitHub Contents API approach fails.
   */
  protected async downloadIconFallback(): Promise<void> {
    const iconSource = this.catalogEntry.logo || this._manifest?.icon;

    if (!iconSource) {
      return;
    }

    if (/^https?:\/\//.test(iconSource)) {
      try {
        const response = await fetch(iconSource);

        if (response.ok) {
          const ext = path.extname(new URL(iconSource).pathname) || '.png';

          await fs.promises.writeFile(path.join(this.dir, `icon${ ext }`), Buffer.from(await response.arrayBuffer()));
        }
      } catch { /* best effort */ }
    } else {
      const installableUrl = this.catalogEntry.installable;

      if (installableUrl) {
        const baseUrl = installableUrl.replace(/\/[^/]+$/, '/');

        try {
          const response = await fetch(`${ baseUrl }${ iconSource }`);

          if (response.ok) {
            const ext = path.extname(iconSource) || '.png';

            await fs.promises.writeFile(path.join(this.dir, `icon${ ext }`), Buffer.from(await response.arrayBuffer()));
          }
        } catch { /* best effort */ }
      }
    }
  }

  protected async runSetup(manifest: InstallationManifest): Promise<void> {
    if (!manifest.setup?.length) {
      return;
    }

    for (const step of manifest.setup) {
      const resolvedCommand = this.resolveCommand(step.command);
      const resolvedCwd = step.cwd
        ? step.cwd.replace(/\$\{APP_DIR\}/g, this.dir)
        : this.dir;
      const isOptional = step.optional !== false;

      sullaLog({ topic: 'extensions', level: 'info', message: `Running setup: ${ resolvedCommand }`, data: { cwd: resolvedCwd, optional: isOptional } });

      try {
        await spawnFile('/bin/sh', ['-c', resolvedCommand], {
          stdio: console,
          cwd:   resolvedCwd,
        });
      } catch (err: any) {
        sullaLog({ topic: 'extensions', level: 'warn', message: `Setup step failed: ${ resolvedCommand }`, error: err, data: { cwd: resolvedCwd, code: err?.code, optional: isOptional } });
        if (!isOptional) {
          throw err;
        }
        sullaLog({ topic: 'extensions', level: 'info', message: `Skipping optional step failure, continuing install...` });
      }
    }
  }

  // ─── Variable Resolution ───────────────────────────────────────────

  /**
   * Resolve `{{variable}}` placeholders in a string.
   *
   * Two forms are supported:
   *  - `{{propertyName}}`          → SullaSettingsModel.get(propertyName)
   *  - `{{INTEGRATION_ID.PROP}}`   → IntegrationService.getIntegrationValue(INTEGRATION_ID, PROP)
   *
   * Unresolvable placeholders are left as-is so the file stays debuggable.
   */
  protected async resolveVariables(content: string): Promise<string> {
    const pattern = /\{\{\s*([^}]+?)\s*\}\}/g;
    const matches = [...content.matchAll(pattern)];

    if (matches.length === 0) {
      return content;
    }

    // Build a lookup map: placeholder key → resolved value
    const resolved = new Map<string, string>();

    for (const match of matches) {
      const key = match[1];

      if (resolved.has(key)) {
        continue;
      }

      const dotIndex = key.indexOf('.');

      if (dotIndex > 0) {
        // Integration variable: {{INTEGRATION_ID.PROPERTY}}
        const integrationId = key.substring(0, dotIndex);
        const property = key.substring(dotIndex + 1);

        try {
          const svc = getIntegrationService();
          const iv = await svc.getIntegrationValue(integrationId, property);

          if (iv) {
            resolved.set(key, iv.value);
          } else {
            sullaLog({ topic: 'extensions', level: 'debug', message: `Variable {{${ key }}} not found in integrations, skipping` });
          }
        } catch (ex) {
          sullaLog({ topic: 'extensions', level: 'debug', message: `Could not resolve integration variable {{${ key }}}`, error: ex });
        }
      } else {
        // Sulla settings variable: {{propertyName}}
        try {
          const value = await SullaSettingsModel.get(key);

          if (value !== null && value !== undefined) {
            resolved.set(key, String(value));
          } else {
            sullaLog({ topic: 'extensions', level: 'debug', message: `Variable {{${ key }}} not found in settings, skipping` });
          }
        } catch (ex) {
          sullaLog({ topic: 'extensions', level: 'debug', message: `Could not resolve setting variable {{${ key }}}`, error: ex });
        }
      }
    }

    // Replace all resolved placeholders
    return content.replace(pattern, (original, key) => {
      const trimmed = key.trim();

      return resolved.has(trimmed) ? resolved.get(trimmed)! : original;
    });
  }

  /**
   * Process the docker-compose file after download: resolve {{variables}} in place.
   */
  protected async processComposeFile(): Promise<void> {
    const composeFile = this._manifest?.compose?.composeFile || 'docker-compose.yml';
    const composePath = path.join(this.dir, composeFile);

    try {
      const raw = await fs.promises.readFile(composePath, 'utf-8');
      const processed = await this.resolveVariables(raw);

      if (processed !== raw) {
        await fs.promises.writeFile(composePath, processed, 'utf-8');
        sullaLog({ topic: 'extensions', level: 'info', message: `Resolved variables in ${ composeFile }` });
      }
    } catch (ex: any) {
      if ((ex as NodeJS.ErrnoException).code !== 'ENOENT') {
        sullaLog({ topic: 'extensions', level: 'warn', message: `Failed to process compose file ${ composePath }`, error: ex });
      }
    }
  }

  /**
   * Write a `.env` file from the manifest's `env` field with {{variables}} resolved.
   * Docker Compose automatically reads `.env` from the working directory.
   */
  protected async writeEnvFile(): Promise<void> {
    const manifest = await this.getManifest();

    if (!manifest.env || Object.keys(manifest.env).length === 0) {
      return;
    }

    const lines: string[] = [];

    for (const [envKey, envVal] of Object.entries(manifest.env)) {
      const resolvedVal = await this.resolveVariables(envVal);

      lines.push(`${ envKey }=${ resolvedVal }`);
    }

    const envPath = path.join(this.dir, '.env');

    await fs.promises.writeFile(envPath, lines.join('\n') + '\n', 'utf-8');
    sullaLog({ topic: 'extensions', level: 'info', message: `Wrote .env with ${ lines.length } entries for ${ this.id }` });
  }

  // ─── Commands ───────────────────────────────────────────────────────

  /**
   * Shell-quote a path for safe use inside `/bin/sh -c` commands.
   * Wraps in single quotes and escapes any embedded single quotes.
   */
  protected shellQuote(value: string): string {
    return `'${ value.replace(/'/g, "'\\''") }'`;
  }

  protected resolveCommand(template: string): string {
    const composeFile = this._manifest?.compose?.composeFile || 'docker-compose.yml';
    const composePath = path.join(this.dir, composeFile);

    return template
      .replace(/\$\{COMPOSE_FILE\}/g, this.shellQuote(composePath))
      .replace(/\$\{APP_DIR\}/g, this.shellQuote(this.dir));
  }

  async start(): Promise<void> {
    const manifest = await this.getManifest();
    const cmd = manifest.commands?.start;

    if (!cmd) {
      console.debug(`No start command for ${ this.id }`);

      return;
    }

    // Refresh .env before starting so settings changes take effect
    await this.writeEnvFile();

    const resolved = this.resolveCommand(cmd);

    sullaLog({ topic: 'extensions', level: 'info', message: `Starting ${ this.id }`, data: { command: resolved, cwd: this.dir } });
    await spawnFile('/bin/sh', ['-c', resolved], { stdio: console, cwd: this.dir });
    sullaLog({ topic: 'extensions', level: 'info', message: `Started ${ this.id } successfully` });
  }

  async stop(): Promise<void> {
    const manifest = await this.getManifest();
    const cmd = manifest.commands?.stop;

    if (!cmd) {
      console.debug(`No stop command for ${ this.id }`);

      return;
    }

    const resolved = this.resolveCommand(cmd);

    sullaLog({ topic: 'extensions', level: 'info', message: `Stopping ${ this.id }`, data: { command: resolved, cwd: this.dir } });
    await spawnFile('/bin/sh', ['-c', resolved], { stdio: console, cwd: this.dir });
    sullaLog({ topic: 'extensions', level: 'info', message: `Stopped ${ this.id } successfully` });
  }

  async restart(): Promise<void> {
    const manifest = await this.getManifest();
    const cmd = manifest.commands?.restart;

    if (!cmd) {
      await this.stop();
      await this.start();

      return;
    }

    const resolved = this.resolveCommand(cmd);

    sullaLog({ topic: 'extensions', level: 'info', message: `Restarting ${ this.id }`, data: { command: resolved, cwd: this.dir } });
    await spawnFile('/bin/sh', ['-c', resolved], { stdio: console, cwd: this.dir });
    sullaLog({ topic: 'extensions', level: 'info', message: `Restarted ${ this.id } successfully` });
  }

  async status(): Promise<string> {
    const manifest = await this.getManifest();
    const cmd = manifest.commands?.status;

    if (!cmd) {
      return 'unknown';
    }

    const resolved = this.resolveCommand(cmd);

    try {
      const result = await spawnFile('/bin/sh', ['-c', resolved], { stdio: 'pipe', cwd: this.dir });

      return (result as any).stdout?.toString?.() ?? 'running';
    } catch {
      return 'stopped';
    }
  }

  // ─── Uninstall ──────────────────────────────────────────────────────

  async uninstall(options?: { deleteData?: boolean }): Promise<boolean> {
    if (!(await this.isInstalled())) {
      return false;
    }

    const deleteData = options?.deleteData ?? false;

    sullaLog({ topic: 'extensions', level: 'info', message: `Uninstalling recipe extension ${ this.id }`, data: { deleteData } });

    // Stop containers if running
    try {
      await this.stop();
    } catch (ex) {
      console.error(`Ignoring error stopping ${ this.id } on uninstall: ${ ex }`);
    }

    // Remove extension directory contents, preserving data/ unless deleteData is set
    const dataDir = path.join(this.dir, 'data');

    try {
      const entries = await fs.promises.readdir(this.dir);

      for (const entry of entries) {
        if (entry === 'data' && !deleteData) {
          continue;
        }
        await fs.promises.rm(path.join(this.dir, entry), { recursive: true, maxRetries: 3 });
      }

      // If deleteData, remove the now-empty directory too
      if (deleteData) {
        await fs.promises.rm(this.dir, { recursive: true, maxRetries: 3 }).catch(() => {});
      }
    } catch (ex: any) {
      if ((ex as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw ex;
      }
    }

    // Clear caches
    this._metadata = undefined;
    this._labels = undefined;
    this._manifest = undefined;

    mainEvents.emit('settings-write', {
      application: { extensions: { installed: { [this.id]: undefined } } },
    });

    sullaLog({ topic: 'extensions', level: 'info', message: `Recipe extension ${ this.id } uninstalled.${ !deleteData ? ' Data directory preserved.' : '' }` });

    return true;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────

  async isInstalled(): Promise<boolean> {
    try {
      const filePath = path.join(this.dir, this.VERSION_FILE);
      const installed = (await fs.promises.readFile(filePath, 'utf-8')).trim();

      return installed === this.version;
    } catch {
      return false;
    }
  }

  async extractFile(_sourcePath: string, _destinationPath: string): Promise<void> {
    // Recipe extensions don't support extractFile — files are fetched from the recipe repo
    throw new ExtensionErrorImpl(
      ExtensionErrorCode.FILE_NOT_FOUND,
      `extractFile is not supported for recipe extensions (${ this.id })`,
    );
  }

  async shutdown(): Promise<void> {
    if (!(await this.isInstalled())) {
      return;
    }

    try {
      await this.stop();
    } catch (ex) {
      console.error(`Ignoring error stopping ${ this.id } on shutdown: ${ ex }`);
    }
  }
}

/**
 * Create a RecipeExtensionImpl from a marketplace catalog entry.
 * Returns undefined if the entry does not have an installable URL.
 */
export async function createRecipeExtension(
  slug: string,
  version: string,
): Promise<RecipeExtensionImpl | undefined> {
  const entries = await fetchMarketplaceData();
  const entry = entries.find(e => e.slug === slug);

  if (!entry?.installable) {
    return undefined;
  }

  return new RecipeExtensionImpl(slug, version, entry);
}
