import fs from 'fs';
import path from 'path';
import paths from '@pkg/utils/paths';
import { getWebSocketClientService, type WebSocketMessage } from './WebSocketClientService';
import { ExtensionMetadata } from '@pkg/main/extensions/types';

interface LocalExtensionMetadata extends ExtensionMetadata {
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
  'ui-sulla'?: {
    'header-menu'?: {
      title: string;
      link: string;
      src: string;
    };
  };
  [key: string]: any;
}

export interface HeaderMenuItem {
  title: string;
  link: string;
  src: string;
}

let extensionServiceInstance: ExtensionService | null = null;

export function getExtensionService(): ExtensionService {
  if (!extensionServiceInstance) {
    extensionServiceInstance = new ExtensionService();
  }
  return extensionServiceInstance;
}

export class ExtensionService {
  private extensions: LocalExtensionMetadata[] = [];
  private headerMenuItems: HeaderMenuItem[] = [];
  private initialized = false;

  constructor() {
    // Constructor doesn't load, call initialize() later
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[ExtensionService] Initializing...');

    try {
      await this.loadExtensionsFromAPI();

      console.log(`[ExtensionService] Loaded ${this.extensions.length} extensions`);
    } catch (err) {
      console.error('[ExtensionService] Initialization failed:', err);
    }

    this.initialized = true;
  }

  private async loadExtensionsFromAPI(): Promise<void> {
    try {
      const statePath = path.join(paths.appHome, 'rd-engine.json');
      const stateData = JSON.parse(await fs.promises.readFile(statePath, 'utf8'));
      const password = stateData.password;
      const auth = btoa(`user:${password}`);
      const response = await fetch('http://localhost:6107/v1/extensions', {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });
      if (response.ok) {
        const extensionsData: Record<string, { version: string, metadata: ExtensionMetadata, labels: Record<string, string> }> = await response.json();
        this.extensions = Object.values(extensionsData).map(ext => ext.metadata as LocalExtensionMetadata);
        for (const ext of Object.values(extensionsData)) {
          const metadata = ext.metadata as LocalExtensionMetadata;
          const uiSulla = metadata['ui-sulla'];
          if (uiSulla?.['header-menu']) {
            this.headerMenuItems.push(uiSulla['header-menu']);
          }
        }
      } else {
        console.error(`Failed to fetch extensions: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to load extensions from API:', error);
    }

    // Menu items will be requested by frontend via IPC

    console.log('ExtensionService initialized with', this.headerMenuItems.length, 'menu items');
    console.log('Menu items:', this.headerMenuItems);
  }

  getHeaderMenuItems(): HeaderMenuItem[] {
    return this.headerMenuItems;
  }

  getExtensions(): LocalExtensionMetadata[] {
    return this.extensions;
  }
}
