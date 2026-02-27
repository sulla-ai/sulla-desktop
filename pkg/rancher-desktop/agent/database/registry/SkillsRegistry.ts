import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Article } from '../models/Article';
import { redisClient } from '../RedisClient';
import {
  SkillService,
  type SkillSchema,
  type SkillSummarySchema,
} from '../../services/SkillService';

export interface SkillRegistryInitOptions {
  filesystemSkillDirs?: string[];
}

export class SkillsRegistry {
  private readonly cacheKey = 'sulla:skills:summary';
  private readonly cacheTimestampKey = 'sulla:skills:summary:timestamp';
  private readonly cacheTTLSeconds = 3600;

  private static instance: SkillsRegistry | null = null;
  private readonly skillsBySlug = new Map<string, SkillService>();
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private refreshPromise: Promise<void> | null = null;
  private cachedSummaries: SkillSummarySchema[] | null = null;
  private cachedAtSeconds = 0;
  private cacheHydrated = false;
  private lastInitOptions: SkillRegistryInitOptions = {};

  static getInstance(): SkillsRegistry {
    return this.instance ?? (this.instance = new SkillsRegistry());
  }

  private constructor() {}

  async initialize(options: SkillRegistryInitOptions = {}): Promise<void> {
    this.lastInitOptions = options;

    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = this.rebuildAndCache(options);
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async rebuildAndCache(options: SkillRegistryInitOptions = {}): Promise<void> {
    const map = new Map<string, SkillService>();

    const databaseSkills = await this.loadDatabaseSkills();
    databaseSkills.forEach(skill => this.mergeSkillBySourcePriority(map, skill));

    const filesystemSkills = await this.loadFilesystemSkills(options.filesystemSkillDirs || []);
    filesystemSkills.forEach(skill => this.mergeSkillBySourcePriority(map, skill));

    this.skillsBySlug.clear();
    map.forEach((skill, slug) => this.skillsBySlug.set(slug, skill));
    this.initialized = true;

    this.cachedSummaries = this.buildSummariesFromCurrentMap();
    this.cachedAtSeconds = Math.floor(Date.now() / 1000);
    this.cacheHydrated = true;
    await this.writeSummariesToCache(this.cachedSummaries, this.cachedAtSeconds);

    console.log(`[SkillsRegistry] initialized with ${this.skillsBySlug.size} skills`);
  }

  async refresh(options: SkillRegistryInitOptions = {}): Promise<void> {
    this.lastInitOptions = options;

    if (this.refreshPromise) {
      await this.refreshPromise;
      return;
    }

    this.refreshPromise = this.rebuildAndCache(options)
      .catch((error) => {
        console.warn('[SkillsRegistry] Background refresh failed:', error);
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    await this.refreshPromise;
  }

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    await this.hydrateSummariesFromCache();

    if (this.cachedSummaries && this.cachedSummaries.length > 0) {
      this.triggerBackgroundRefreshIfNeeded();
      return;
    }

    await this.initialize(this.lastInitOptions);
  }

  async getSkill(slug: string): Promise<SkillService | null> {
    await this.ensureInitialized();

    if (!this.initialized) {
      await this.initialize(this.lastInitOptions);
    }

    return this.skillsBySlug.get(String(slug || '').trim()) ?? null;
  }

  async listSkills(): Promise<SkillService[]> {
    await this.ensureInitialized();

    if (!this.initialized) {
      this.triggerBackgroundRefreshIfNeeded();
      return [];
    }

    return Array.from(this.skillsBySlug.values());
  }

  async getSkillSchemas(): Promise<SkillSchema[]> {
    const skills = await this.listSkills();
    return skills.map(skill => skill.getSchema());
  }

  async getSkillSummaries(): Promise<SkillSummarySchema[]> {
    await this.ensureInitialized();

    if (this.cachedSummaries && this.cachedSummaries.length > 0) {
      this.triggerBackgroundRefreshIfNeeded();
      return this.cachedSummaries;
    }

    const summaries = this.buildSummariesFromCurrentMap();
    this.cachedSummaries = summaries;
    this.cachedAtSeconds = Math.floor(Date.now() / 1000);
    return summaries;
  }

  async getPlanRetrievalSkillList(): Promise<Array<{ slug: string; name: string; triggers: string[]; description: string }>> {
    if (!this.initialized) {
      await this.initialize(this.lastInitOptions);
    }

    return this.buildSummariesFromCurrentMap();
  }

  async getPlanRetrievalSkillPrompt(): Promise<string> {
    const skills = await this.getPlanRetrievalSkillList();
    if (!skills || skills.length === 0) {
      return '_No skills found in the knowledge base yet._';
    }

    const lines: string[] = [];
    const seenSlugs = new Set<string>();

    for (const skill of skills) {
      const slug = skill.slug || 'unknown';
      if (seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);

      const title = skill.name || slug;
      const trigger = Array.isArray(skill.triggers) ? skill.triggers.join(', ') : '';
      if (!trigger || /^no\s+trigger\s+defined$/i.test(trigger)) continue;

      lines.push(`- **${title}** (slug: \`${slug}\`)\n  Trigger: ${trigger}`);
    }

    return lines.length > 0
      ? lines.join('\n')
      : '_No skills found in the knowledge base yet._';
  }

  private async loadDatabaseSkills(): Promise<SkillService[]> {
    try {
      const articles = await Article.findByTag('skill');
      const skills: SkillService[] = [];

      for (const article of articles) {
        const manifest = {
          slug: String(article.attributes.slug || '').trim(),
          title: String(article.attributes.title || '').trim(),
          section: article.attributes.section,
          category: article.attributes.category,
          tags: Array.isArray(article.attributes.tags) ? article.attributes.tags : [],
          order: article.attributes.order,
          locked: article.attributes.locked,
          author: article.attributes.author,
          created_at: article.attributes.created_at,
          updated_at: article.attributes.updated_at,
          mentions: Array.isArray(article.attributes.mentions) ? article.attributes.mentions : [],
          related_entities: Array.isArray(article.attributes.related_entities) ? article.attributes.related_entities : [],
        };

        const service = SkillService.fromParts('database', manifest, String(article.attributes.document || ''));
        if (!service) continue;

        skills.push(service);
      }

      return skills;
    } catch (error) {
      console.warn('[SkillsRegistry] Failed to load skills from database:', error);
      return [];
    }
  }

  private async loadFilesystemSkills(extraDirs: string[]): Promise<SkillService[]> {
    const skills: SkillService[] = [];
    const candidateDirs = this.getDefaultFilesystemDirs(extraDirs);

    for (const dir of candidateDirs) {
      // Folder-based: look for <dir>/<name>/SKILL.md first
      const folderSkills = await this.loadFolderBasedSkills(dir);
      skills.push(...folderSkills);

      // Legacy flat scan: any .md files directly in the dir tree
      const markdownFiles = await this.collectMarkdownFiles(dir);
      const folderSlugs = new Set(folderSkills.map(s => s.slug));

      for (const filePath of markdownFiles) {
        try {
          const raw = await readFile(filePath, 'utf8');
          const fallbackSlug = path.basename(filePath, path.extname(filePath));
          const service = SkillService.fromRaw('filesystem', fallbackSlug, raw);
          if (!service) continue;
          if (folderSlugs.has(service.slug)) continue;
          if (!this.looksLikeSkill(service)) continue;
          skills.push(service);
        } catch (error) {
          console.warn(`[SkillsRegistry] Failed to load skill file ${filePath}:`, error);
        }
      }
    }

    return skills;
  }

  private async loadFolderBasedSkills(parentDir: string): Promise<SkillService[]> {
    const skills: SkillService[] = [];
    let entries: import('node:fs').Dirent[];
    try {
      entries = await readdir(parentDir, { withFileTypes: true });
    } catch {
      return skills;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(parentDir, entry.name, 'SKILL.md');
      try {
        const raw = await readFile(skillMd, 'utf8');
        const service = SkillService.fromRaw('filesystem', entry.name, raw);
        if (service) skills.push(service);
      } catch {
        // No SKILL.md in this subfolder — skip
      }
    }

    return skills;
  }

  private looksLikeSkill(skill: SkillService): boolean {
    const tags = Array.isArray(skill.manifest.tags) ? skill.manifest.tags.map(t => String(t).toLowerCase()) : [];
    if (tags.includes('skill')) return true;

    const slug = skill.slug.toLowerCase();
    return slug.startsWith('skill-') || slug.startsWith('sop-');
  }

  private getDefaultFilesystemDirs(extraDirs: string[]): string[] {
    const userSkillsDir = this.getUserSkillsDir();

    const fromEnv = String(process.env.SULLA_SKILLS_DIRS || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);

    const all = [...extraDirs, ...fromEnv, userSkillsDir]
      .map(dir => path.resolve(dir));

    return Array.from(new Set(all));
  }

  getUserSkillsDir(): string {
    const envPath = String(process.env.SULLA_SKILLS_DIR || '').trim();
    if (envPath) {
      return path.isAbsolute(envPath) ? envPath : path.resolve(envPath);
    }
    return path.join(os.homedir(), 'sulla', 'skills');
  }

  private async collectMarkdownFiles(dirPath: string): Promise<string[]> {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      const files: string[] = [];

      for (const entry of entries) {
        const abs = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          const nested = await this.collectMarkdownFiles(abs);
          files.push(...nested);
          continue;
        }

        if (!entry.isFile()) continue;

        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.md' || ext === '.markdown') {
          files.push(abs);
        }
      }

      return files;
    } catch {
      return [];
    }
  }

  private buildSummariesFromCurrentMap(): SkillSummarySchema[] {
    return Array.from(this.skillsBySlug.values()).map(skill => skill.getSummarySchema());
  }

  private mergeSkillBySourcePriority(map: Map<string, SkillService>, incoming: SkillService): void {
    const slug = String(incoming.slug || '').trim();
    if (!slug) return;

    const existing = map.get(slug);
    if (!existing) {
      map.set(slug, incoming);
      return;
    }

    const existingPriority = this.getSourcePriority(existing.source);
    const incomingPriority = this.getSourcePriority(incoming.source);

    if (incomingPriority >= existingPriority) {
      map.set(slug, incoming);
    }
  }

  private getSourcePriority(source: string): number {
    switch (String(source || '').toLowerCase()) {
      case 'filesystem':
        return 2;
      case 'database':
      default:
        return 1;
    }
  }

  private async hydrateSummariesFromCache(): Promise<void> {
    if (this.cacheHydrated) return;
    this.cacheHydrated = true;

    try {
      const redisReady = await redisClient.initialize();
      if (!redisReady) return;

      const cachedPayload = await redisClient.get(this.cacheKey);
      const timestampStr = await redisClient.get(this.cacheTimestampKey);

      if (!cachedPayload) return;

      const parsed = JSON.parse(cachedPayload) as SkillSummarySchema[];
      if (!Array.isArray(parsed)) return;

      this.cachedSummaries = parsed;
      this.cachedAtSeconds = timestampStr ? parseInt(timestampStr, 10) || 0 : 0;
    } catch (error) {
      console.warn('[SkillsRegistry] Failed to hydrate summary cache:', error);
    }
  }

  private async writeSummariesToCache(summaries: SkillSummarySchema[], timestamp: number): Promise<void> {
    try {
      const redisReady = await redisClient.initialize();
      if (!redisReady) return;

      await redisClient.set(this.cacheKey, JSON.stringify(summaries));
      await redisClient.set(this.cacheTimestampKey, String(timestamp));
    } catch (error) {
      console.warn('[SkillsRegistry] Failed to write summary cache:', error);
    }
  }

  private triggerBackgroundRefreshIfNeeded(): void {
    const now = Math.floor(Date.now() / 1000);
    const age = now - this.cachedAtSeconds;
    const stale = this.cachedAtSeconds === 0 || age > this.cacheTTLSeconds;

    if (!stale || this.refreshPromise) return;

    this.refresh(this.lastInitOptions).catch((error) => {
      console.warn('[SkillsRegistry] Non-blocking refresh failed:', error);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // SkillStore API — used by skills tools
  // ─────────────────────────────────────────────────────────────

  async searchSkills(query: string): Promise<string> {
    await this.ensureInitialized();

    const queryWords = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (queryWords.length === 0) return 'Please provide a search query.';

    const nativeResults: string[] = [];
    const dynamicResults: string[] = [];

    // Search native skills
    try {
      const { nativeSkillRegistry } = await import('../../skills/native/NativeSkillRegistry');
      const nativeMatches = nativeSkillRegistry.search(query);
      for (const m of nativeMatches) {
        nativeResults.push(`${m.name} (native): ${m.description}`);
      }
    } catch { /* native registry not available */ }

    // Search dynamic/filesystem/hardcoded skills
    for (const skill of this.skillsBySlug.values()) {
      const haystack = [
        skill.slug,
        skill.name,
        skill.description,
        ...(skill.manifest.tags || []),
        ...(skill.triggers || []),
      ].join(' ').toLowerCase();

      if (queryWords.some(word => haystack.includes(word))) {
        dynamicResults.push(`${skill.name}: ${skill.description}`);
      }
    }

    const parts: string[] = [];
    if (nativeResults.length > 0) parts.push(`Native skills:\n${nativeResults.join('\n')}`);
    if (dynamicResults.length > 0) parts.push(`Dynamic skills:\n${dynamicResults.join('\n')}`);

    return parts.length > 0
      ? parts.join('\n\n')
      : 'No matching skills. You can create one with create_skill.';
  }

  async loadSkill(skillName: string): Promise<string> {
    await this.ensureInitialized();

    const name = String(skillName || '').trim();

    // Check native skills first — call func() to return full skill content
    try {
      const { nativeSkillRegistry } = await import('../../skills/native/NativeSkillRegistry');
      const nativeDef = nativeSkillRegistry.get(name);
      if (nativeDef) {
        return await nativeDef.func({});
      }
    } catch { /* native registry not available */ }

    // Try exact slug match
    const bySlug = this.skillsBySlug.get(name);
    if (bySlug) return bySlug.document;

    // Try folder name match in user skills dir
    const userDir = this.getUserSkillsDir();
    const skillMd = path.join(userDir, name, 'SKILL.md');
    if (fs.existsSync(skillMd)) {
      return fs.readFileSync(skillMd, 'utf8');
    }

    // Try fuzzy match by name
    for (const skill of this.skillsBySlug.values()) {
      if (skill.name.toLowerCase() === name.toLowerCase()) {
        return skill.document;
      }
    }

    const available = Array.from(this.skillsBySlug.keys()).join(', ') || '(none)';
    return `Skill '${name}' not found. Available: ${available}`;
  }

  async createSkill(skillName: string, content: string): Promise<string> {
    const name = String(skillName || '').trim();
    if (!name) return 'Skill name is required.';

    const userDir = this.getUserSkillsDir();
    const skillDir = path.join(userDir, name);
    const skillFile = path.join(skillDir, 'SKILL.md');

    try {
      await mkdir(skillDir, { recursive: true });
      await writeFile(skillFile, content, 'utf8');

      // Reload from the new file so the registry picks it up immediately
      const service = SkillService.fromRaw('filesystem', name, content);
      if (service) {
        this.skillsBySlug.set(service.slug, service);
        this.cachedSummaries = this.buildSummariesFromCurrentMap();
      }

      return `Skill '${name}' created/updated successfully at ${skillFile}. You can now load it anytime with load_skill.`;
    } catch (error: any) {
      return `Failed to create skill '${name}': ${error.message}`;
    }
  }
}

export const skillsRegistry = SkillsRegistry.getInstance();
