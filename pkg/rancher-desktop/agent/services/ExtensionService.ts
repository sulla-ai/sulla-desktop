import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import paths from '@pkg/utils/paths';
import { ExtensionMetadata } from '@pkg/main/extensions/types';
import { Integration } from '../integrations/catalog';

const MARKETPLACE_URL = 'https://raw.githubusercontent.com/sulla-ai/sulla-recipes/refs/heads/main/index.yaml';
const CACHE_TTL_MS = 30 * 60 * 1000;

export interface MarketplaceEntry {
  slug:                  string;
  version:               string;
  containerd_compatible: boolean;
  labels:                Record<string, string>;
  title:                 string;
  logo:                  string;
  publisher:             string;
  short_description:     string;
  installable?:          string;
}

export interface InstalledExtension {
  id:               string;
  version:          string;
  metadata:         ExtensionMetadata;
  labels:           Record<string, string>;
  extraUrls:        Array<{ label: string; url: string }>;
  availableVersion?: string;
  canUpgrade:       boolean;
}

export interface LocalExtensionMetadata extends ExtensionMetadata {
  id: string;
  name: string;
  version: string;
  title: string;
  description: string;
  vendor: string;
  category: string;
  platforms: string[];
  extensionScreenshots: any[];
  tags: string[];
  containers: any;
  ui: Record<string, {
    title: string;
    root: string;
    src: string;
    showInHeader?: boolean;
    displayMode?: 'embedded' | 'iframe';
  }>;
  integrations: Record<string, Integration>;
  [key: string]: any;
}

export interface HeaderMenuItem {
  title: string;
  root: string;
  src: string;
  link: string;
  displayMode?: 'embedded' | 'iframe';
}

let extensionServiceInstance: ExtensionService | null = null;

export function getExtensionService(): ExtensionService {
  if (!extensionServiceInstance) {
    extensionServiceInstance = new ExtensionService();
  }
  return extensionServiceInstance;
}

export class ExtensionService {
  private backendUrl = 'http://127.0.0.1:6107';
  private extensionsMetadata: LocalExtensionMetadata[] = [];
  private headerMenuItems: HeaderMenuItem[] = [];
  private initialized = false;
  private cachedMarketplace: MarketplaceEntry[] | undefined;
  private marketplaceCacheExpires = 0;
  private inFlightMarketplaceFetch: Promise<MarketplaceEntry[]> | undefined;

  constructor() {
    // Constructor doesn't load, call initialize() later
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[ExtensionService] Initializing...');

    try {
      await this.loadExtensionsFromAPI();

      console.log(`[ExtensionService] Loaded ${this.extensionsMetadata.length} extensions`);
    } catch (err) {
      console.error('[ExtensionService] Initialization failed:', err);
    }

    this.initialized = true;
  }

  private async loadExtensionsFromAPI(): Promise<void> {
    try {
      const response = await fetch(`${this.backendUrl}/v1/extensions`, {
        headers: this.getRequestHeaders()
      });

      if (!response.ok) {
        console.error(`[ExtensionService] Failed to fetch extensions: ${response.status}`);
        return;
      }

      const extensionsData: Record<string, { 
        version: string, 
        metadata: ExtensionMetadata, 
        labels: Record<string, string> 
      }> = await response.json();

      this.extensionsMetadata = Object.entries(extensionsData).map(([key, ext]) => (
        { ...ext.metadata, id: key } as LocalExtensionMetadata
      ));
      
      for (const metadata of this.extensionsMetadata) {
        const ui = metadata['ui'] || {};
        const headerMenuItems = Object.entries(ui).filter(([_, item]) => item.showInHeader);

        for (const [itemKey, item] of headerMenuItems) {
          this.headerMenuItems.push({
            ...item,
            link: `/Extension/${metadata.name}/ui/${itemKey}/${item.root}/${item.src}`
          });
        }
      }
    } catch (error) {
      console.error('[ExtensionService] Failed to load extensions from API:', error);
    }
    
    console.log('[ExtensionService] Initialization complete');
  }

  private getRequestHeaders(): Record<string, string> {
    const statePath = path.join(paths.appHome, 'rd-engine.json');
    const stateData = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const auth = btoa(`user:${ stateData.password }`);
    
    return {
      'Authorization': `Basic ${auth}`
    };
  }

  getHeaderMenuItems(): HeaderMenuItem[] {
    return this.headerMenuItems;
  }

  getHeaderMenuItemByLink(link: string): HeaderMenuItem | undefined {
    return this.headerMenuItems.find(item => item.link === link);
  }

  getExtensionsMetadata(): LocalExtensionMetadata[] {
    return this.extensionsMetadata;
  }

  getExtensionMetadata(name: string): LocalExtensionMetadata | undefined {
    return this.extensionsMetadata.find(ext => ext.name === name);
  }
  
  getExtensionIntegrations(): Integration[] {
    const allIntegrations: Integration[] = [];
    
    for (const ext of this.extensionsMetadata) {
      if (ext.integrations) {
        for (const [_, integration] of Object.entries(ext.integrations)) {
          allIntegrations.push(integration);
        }
      }
    }
    
    return allIntegrations;
  }

  async fetchMarketplaceData(): Promise<MarketplaceEntry[]> {
    if (this.cachedMarketplace && Date.now() < this.marketplaceCacheExpires) {
      return this.cachedMarketplace;
    }

    if (this.inFlightMarketplaceFetch) {
      return this.inFlightMarketplaceFetch;
    }

    this.inFlightMarketplaceFetch = (async () => {
      try {
        const response = await fetch(MARKETPLACE_URL);

        if (!response.ok) {
          console.error(`[ExtensionService] Failed to fetch marketplace: ${response.status}`);
          return this.cachedMarketplace ?? [];
        }

        const text = await response.text();
        const parsed = yaml.parse(text) as { plugins?: MarketplaceEntry[] };

        this.cachedMarketplace = parsed.plugins ?? [];
        this.marketplaceCacheExpires = Date.now() + CACHE_TTL_MS;

        return this.cachedMarketplace;
      } catch (ex) {
        console.error(`[ExtensionService] Error fetching marketplace: ${ex}`);
        return this.cachedMarketplace ?? [];
      } finally {
        this.inFlightMarketplaceFetch = undefined;
      }
    })();

    return this.inFlightMarketplaceFetch;
  }

  async fetchInstalledExtensions(): Promise<InstalledExtension[]> {
    try {
      const response = await fetch(`${this.backendUrl}/v1/extensions`, {
        headers: this.getRequestHeaders(),
      });

      if (!response.ok) {
        console.error(`[ExtensionService] Failed to fetch installed extensions: ${response.status}`);
        return [];
      }

      const data: Record<string, { version: string; metadata: ExtensionMetadata; labels: Record<string, string>; extraUrls?: Array<{ label: string; url: string }> }> = await response.json();
      const marketplace = await this.fetchMarketplaceData();

      return Object.entries(data).map(([id, ext]) => {
        const marketEntry = marketplace.find(m => m.slug === id);
        let canUpgrade = false;

        if (marketEntry) {
          try {
            const { default: semver } = require('semver') as { default: typeof import('semver') };
            canUpgrade = semver.gt(marketEntry.version, ext.version);
          } catch { /* ignore */ }
        }

        return {
          id,
          version:          ext.version,
          metadata:         ext.metadata,
          labels:           ext.labels,
          extraUrls:        ext.extraUrls ?? [],
          availableVersion: marketEntry?.version,
          canUpgrade,
        };
      });
    } catch (error) {
      console.error('[ExtensionService] Failed to fetch installed extensions:', error);
      return [];
    }
  }

  async installExtension(id: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.backendUrl}/v1/extensions/install?id=${encodeURIComponent(id)}`, {
        method:  'POST',
        headers: this.getRequestHeaders(),
      });

      if (!response.ok) {
        return { ok: false, error: response.statusText };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }

  async uninstallExtension(id: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.backendUrl}/v1/extensions/uninstall?id=${encodeURIComponent(id)}`, {
        method:  'POST',
        headers: this.getRequestHeaders(),
      });

      if (!response.ok) {
        return { ok: false, error: response.statusText };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }
}
