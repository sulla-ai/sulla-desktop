import { getWebSocketClientService, type WebSocketMessage } from './WebSocketClientService';

export interface ExtensionMetadata {
  name: string;
  version: string;
  title: string;
  description: string;
  vendor: string;
  icon: string;
  category: string;
  platforms: string[];
  extensionScreenshots: any[];
  tags: string[];
  ui: {
    dashboardTab?: {
      title: string;
      root: string;
      src: string;
    };
  };
  'ui-sulla'?: {
    'header-menu'?: {
      title: string;
      link: string;
      src: string;
    };
  };
  containers: any;
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
  private initialized = false;
  private extensions: ExtensionMetadata[] = [];
  private headerMenuItems: HeaderMenuItem[] = [];
  private extensionUrls = ['http://localhost:8080']; // Example for voice-ai

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[ExtensionService] Initializing...');

    try {
      await this.loadExtensions(this.extensionUrls);

      console.log(`[ExtensionService] Loaded ${this.extensions.length} extensions`);
    } catch (err) {
      console.error('[ExtensionService] Initialization failed:', err);
    }

    this.initialized = true;
  }

  private async loadExtensions(urls: string[]) {
    for (const url of urls) {
      try {
        const response = await fetch(`${url}/metadata.json`);
        if (response.ok) {
          const metadata: ExtensionMetadata = await response.json();
          this.extensions.push(metadata);
          if (metadata['ui-sulla']?.['header-menu']) {
            this.headerMenuItems.push(metadata['ui-sulla']['header-menu']);
          }
        }
      } catch (error) {
        console.error(`Failed to load extension metadata from ${url}:`, error);
      }
    }

    // Send to frontend
    const wsService = getWebSocketClientService();
    wsService.send('chat-controller', { type: 'extension_menu_items', data: this.headerMenuItems });
  }

  getHeaderMenuItems(): HeaderMenuItem[] {
    return this.headerMenuItems;
  }

  getExtensions(): ExtensionMetadata[] {
    return this.extensions;
  }
}
