// ComposioService — wraps @composio/core SDK, manages client lifecycle and
// bridges Composio tools into Sulla's skills + integrations systems.
// Composio manages its own auth configs and connected accounts.
// Tool visibility is gated by the native `composio` integration in the catalog.

import { getIntegrationService } from './IntegrationService';

/** Shape of a Composio tool as returned by getRawComposioTools */
export interface ComposioToolSchema {
  slug: string;
  name: string;
  description: string;
  toolkit?: { slug?: string; name?: string };
  inputParameters?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Lightweight summary exposed to the skills layer */
export interface ComposioSkillSummary {
  slug: string;
  name: string;
  description: string;
  toolkitSlug: string;
  integrationId: string;
  tags: string[];
}

let composioServiceInstance: ComposioService | null = null;

export function getComposioService(): ComposioService {
  if (!composioServiceInstance) {
    composioServiceInstance = new ComposioService();
  }
  return composioServiceInstance;
}

export class ComposioService {
  private client: any | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  // toolkitSlug → cached tool list
  private toolCache = new Map<string, ComposioToolSchema[]>();

  // Whether the composio integration gate is currently enabled
  private gateOpen = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) { await this.initPromise; return; }

    this.initPromise = this._doInit();
    try { await this.initPromise; } finally { this.initPromise = null; }
  }

  private async _doInit(): Promise<void> {
    const intService = getIntegrationService();
    await intService.initialize();

    const activeAccountId = await intService.getActiveAccountId('composio');
    const apiKeyValue = await intService.getIntegrationValue('composio', 'api_key', activeAccountId);
    const baseUrlValue = await intService.getIntegrationValue('composio', 'base_url', activeAccountId);

    const apiKey = (apiKeyValue?.value || '').trim();
    const baseURL = (baseUrlValue?.value || '').trim();

    if (!apiKey) {
      console.warn('[ComposioService] composio.api_key not set in IntegrationService — Composio integration disabled');
      this.initialized = true;
      return;
    }

    try {
      const { Composio } = await import('@composio/core');
      this.client = new Composio({
        apiKey,
        ...(baseURL ? { baseURL } : {}),
      });
      console.log('[ComposioService] Composio client initialized');
    } catch (err) {
      console.warn('[ComposioService] Failed to initialize Composio client:', err);
    }

    // Check if the composio integration gate is enabled
    await this.refreshGate();

    this.initialized = true;
    console.log(`[ComposioService] Initialized — gate ${this.gateOpen ? 'open' : 'closed'}`);
  }

  /** Check whether the `composio` integration is connected (master gate) */
  private async refreshGate(): Promise<void> {
    try {
      const intService = getIntegrationService();
      await intService.initialize();
      const status = await intService.getConnectionStatus('composio');
      this.gateOpen = status.connected;
    } catch {
      this.gateOpen = false;
    }
  }

  /** Check if Composio SDK is available */
  isAvailable(): boolean {
    return this.client !== null;
  }

  /** Check if the composio gate is open */
  isGateOpen(): boolean {
    return this.gateOpen;
  }

  /**
   * Fetch Composio tools for a given toolkit slug.
   * Results are cached per-toolkit until clearToolCache() is called.
   */
  async getToolsForToolkit(toolkitSlug: string): Promise<ComposioToolSchema[]> {
    if (!this.client) return [];

    if (this.toolCache.has(toolkitSlug)) {
      return this.toolCache.get(toolkitSlug)!;
    }

    try {
      const rawTools = await this.client.tools.getRawComposioTools({
        toolkits: [toolkitSlug],
        limit: 100,
      });

      const tools: ComposioToolSchema[] = (rawTools?.items || rawTools || []).map((t: any) => ({
        slug: t.slug || t.name || '',
        name: t.name || t.slug || '',
        description: t.description || '',
        toolkit: t.toolkit || { slug: toolkitSlug },
        inputParameters: t.inputParameters || {},
      }));

      this.toolCache.set(toolkitSlug, tools);
      return tools;
    } catch (err) {
      console.warn(`[ComposioService] Failed to fetch tools for toolkit ${toolkitSlug}:`, err);
      return [];
    }
  }

  /**
   * Execute a Composio tool by slug.
   */
  async executeTool(
    toolSlug: string,
    args: Record<string, unknown>,
    integrationId?: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Composio client not initialized. Set Composio API Key in Integrations > Composio.' };
    }

    await this.refreshGate();
    if (!this.gateOpen) {
      return { success: false, error: 'Composio integration is not enabled. Connect the Composio integration first.' };
    }

    const userId = integrationId ? `sulla-${integrationId}` : 'default';

    try {
      const result = await this.client.tools.execute(toolSlug, {
        userId,
        arguments: args,
        dangerouslySkipVersionCheck: true,
      });

      return { success: true, data: result?.data ?? result };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Get all available Composio tools as skill summaries.
   * Gated by the `composio` integration connection status.
   */
  async getActiveSkillSummaries(): Promise<ComposioSkillSummary[]> {
    await this.initialize();
    if (!this.client) return [];

    // Refresh gate each call so toggles are reflected immediately
    await this.refreshGate();
    if (!this.gateOpen) return [];

    const summaries: ComposioSkillSummary[] = [];

    try {
      // Discover all available tools from Composio
      const rawTools = await this.client.tools.getRawComposioTools({ limit: 500 });
      const tools = rawTools?.items || rawTools || [];

      for (const t of tools) {
        const toolkitSlug = t.toolkit?.slug || 'unknown';
        summaries.push({
          slug: t.slug || t.name || '',
          name: t.name || t.slug || '',
          description: t.description || '',
          toolkitSlug,
          integrationId: toolkitSlug,
          tags: ['composio', toolkitSlug],
        });
      }
    } catch (err) {
      console.warn('[ComposioService] Failed to fetch active skill summaries:', err);
    }

    return summaries;
  }

  /**
   * Search Composio skills by query string.
   * Matches against name, description, toolkit slug, and tags.
   */
  async searchSkills(query: string): Promise<ComposioSkillSummary[]> {
    const summaries = await this.getActiveSkillSummaries();
    if (!query.trim()) return summaries;

    const q = query.toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);

    return summaries.filter(s => {
      const haystack = [s.name, s.description, s.toolkitSlug, s.integrationId, ...s.tags]
        .join(' ')
        .toLowerCase();
      return words.some(w => haystack.includes(w));
    });
  }

  /** Clear the cached tool lists */
  clearToolCache(): void {
    this.toolCache.clear();
  }
}
