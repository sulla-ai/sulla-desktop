// src/models/SullaSettingsModel.ts

import crypto from 'crypto';
import * as fs from 'fs/promises';

import { BaseModel } from '../BaseModel';
import { redisClient } from '../RedisClient';

interface SettingsAttributes {
  property: string;
  value: any;
}

export class SullaSettingsModel extends BaseModel<SettingsAttributes> {
  protected readonly tableName = 'sulla_settings';
  protected get tableRef(): string {
    return 'sulla_settings';
  }

  protected primaryKey = 'property';
  protected fillable: string[] = ['property', 'value'];
  protected guarded: string[] = [];
  protected timestamps = false;

  // ──────────────────────────────────────────────
  // Persistent installation file path (decided once per process)
  // ──────────────────────────────────────────────

  // without this file, the system will demand to be installed again and again
  protected static installationLockFile: string | null = null;

  /** Returns the same fallback file path for the entire process lifetime */
  public static getFallbackFilePath(): string {
    if (SullaSettingsModel.installationLockFile) {
      return SullaSettingsModel.installationLockFile;
    }
    throw new Error('Fallback path not set');
  }

  public static setFallbackFilePath(path: string): void {
    SullaSettingsModel.installationLockFile = path;
  }

  // ──────────────────────────────────────────────
  // Bootstrap / Offline-First Fallback Layer
  // ──────────────────────────────────────────────

  private static isReady: boolean = false;
  private static fallbackData: Map<string, any> = new Map();

  // ──────────────────────────────────────────────
  // Bootstrap: sync fallback → real backends
  // Call once after PG + Redis are confirmed ready
  // ──────────────────────────────────────────────

  /**
   * Full bootstrap: call when DBs are ready
   * 
   * @returns 
   */
  public static async bootstrap(): Promise<void> {
    if (this.isReady) return; // run once

    console.log('SullaSettingsModel: full bootstrap starting');

    // PG → Redis
    // now that the system is ready we can write to persistent storage
    await this.initialize();
    this.isReady = true;

    // Read from installation lock file and sync to persistent storage
    try {
      const content = await fs.readFile(this.getFallbackFilePath(), 'utf8');
      const data = JSON.parse(content) as Record<string, any>;
      for (const [property, value] of Object.entries(data)) {
        await this.setSetting(property, value);
      }
      console.log(`SullaSettingsModel: synced ${Object.keys(data).length} settings from lock file`);
    } catch (err) {
      console.log('SullaSettingsModel: no lock file to sync or error reading:', err);
    }

    // do not delete the fallback file. it acts as our installation lock file

    console.log('SullaSettingsModel: full bootstrap complete');
  }

  // ──────────────────────────────────────────────
  // Sync PG → Redis on startup or after bootstrap
  // ──────────────────────────────────────────────

  /**
   * Sync all settings from PostgreSQL to Redis
   * @returns 
   */
  public static async initialize(): Promise<void> {
    const all = await this.all();
    if (all.length === 0) return;

    const pipeline = redisClient.pipeline();
    for (const setting of all) {
      const property = setting.attributes.property as string;
      const value = setting.attributes.value;
      pipeline.hset('sulla_settings', property, JSON.stringify(value));
    }
    await pipeline.exec();
  }

  // ──────────────────────────────────────────────
  // Core Get / Set with fallback → redis → pg
  // ──────────────────────────────────────────────

  /**
   * 
   * @param property 
   * @param _default 
   * @returns 
   */
  public static async getSetting(property: string, _default: any = null): Promise<any> {
    if (this.isReady) {
      // Redis → PG path (unchanged)
      const cached = await redisClient.hget('sulla_settings', property);
      if (cached !== null) {
        try { return JSON.parse(cached); } catch (e) { console.error(`Redis parse fail: ${property}`, e); }
      }
      const setting = await this.find(property);
      if (setting) {
        const value = setting.attributes.value;
        await redisClient.hset('sulla_settings', property, JSON.stringify(value));
        return value;
      }
      return _default;
    }

    // Fallback: always read fresh from disk
    const filePath = this.getFallbackFilePath();
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content) as Record<string, any>;
      return property in data ? data[property] : _default;
    } catch (err) {
      console.warn(`Fallback read fail for ${property}:`, err);
      return _default;
    }
  }

  /**
   * 
   * @param property 
   * @param value 
   * @returns 
   */
  public static async setSetting(property: string, value: any): Promise<void> {
    if (this.isReady) {
      // Write-through to PG + Redis (unchanged)
      const model = new this();
      model.attributes = { property, value };
      await model.save();
      await redisClient.hset('sulla_settings', property, JSON.stringify(value));
      return;
    }

    // Fallback: update buffer and debounce save
    const filePath = this.getFallbackFilePath();
    let data: Record<string, any> = {};
    try {
      const content = await fs.readFile(filePath, 'utf8');
      data = JSON.parse(content);
    } catch {} // file missing → start empty

    data[property] = value;
    this.fallbackData = new Map(Object.entries(data));
    await this.debouncedSaveFallback();
  }

  /**
   * Public API
   * @param property 
   * @param defaultValue 
   * @returns 
   */
  public static async get(property: string, defaultValue: any = null): Promise<any> {
    return this.getSetting(property, defaultValue);
  }

  /**
   * Public API
   * @param property 
   * @param value 
   * @returns 
   */
  public static async set(property: string, value: any): Promise<void> {
    return this.setSetting(property, value);
  }

  // ──────────────────────────────────────────────
  // Utils
  // ──────────────────────────────────────────────

  public static async delete(property: string): Promise<void> {
    if (!this.isReady) {
      const filePath = this.getFallbackFilePath();
      let data: Record<string, any> = {};
      try {
        const content = await fs.readFile(filePath, 'utf8');
        data = JSON.parse(content);
      } catch {} // file missing → do nothing
      delete data[property];
      this.fallbackData = new Map(Object.entries(data));
      await this.debouncedSaveFallback();
      return;
    }

    const model = new this();
    model.attributes.property = property;
    await model.delete();
    await redisClient.hdel('sulla_settings', property);
  }

  public static generatePassword(length = 16): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
    return Array.from(crypto.randomBytes(length))
      .map(b => chars[b % chars.length])
      .join('');
  }

  public static generateEncryptionKey(length = 32): string {
    return crypto.randomBytes(length).toString('base64');
  }

  public static generateId(): string {
    return crypto.randomUUID();
  }

  private static saveTimeout: NodeJS.Timeout | null = null;
  private static readonly DEBOUNCE_MS = 300; // adjust as needed

  private static async debouncedSaveFallback(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(async () => {
      this.saveTimeout = null;
      const filePath = this.getFallbackFilePath();
      const obj = Object.fromEntries(this.fallbackData);
      try {
        await fs.writeFile(filePath, JSON.stringify(obj, null, 2));
      } catch (err) {
        console.error('Fallback save failed:', err);
      }
    }, this.DEBOUNCE_MS);
  }
}

