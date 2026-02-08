// src/database/ChromaBaseModel.ts
import { chromaClient } from './ChromaDb';
import { getModelMode, getRemoteConfig } from '../services/ConfigService';

interface ChromaDocument {
  id: string;
  document: string;
  metadata: Record<string, any>;
}

export abstract class ChromaBaseModel {
  protected abstract collectionName: string;
  protected abstract idField: string; // e.g. 'threadId' or 'slug'

  protected fillable: string[] = [];
  protected required: string[] = [];
  protected defaults: Record<string, any> = {};

  public attributes: Record<string, any> = {};

  constructor() {}

  public fill(data: Record<string, any>) {
    for (const [key, value] of Object.entries(data)) {
      if (this.fillable.includes(key)) {
        this.attributes[key] = value;
        // Set as property only if no getter exists
        const descriptor = Object.getOwnPropertyDescriptor(this.constructor.prototype, key);
        if (!descriptor?.get) {
          (this as any)[key] = value;
        }
      }
    }
  }

  protected validateAndApplyDefaults(): void {
    // Apply defaults
    for (const [key, value] of Object.entries(this.defaults)) {
      if (!(key in this.attributes)) {
        this.attributes[key] = value;
        (this as any)[key] = value;
      }
    }

    // Enforce required
    for (const field of this.required) {
      if (!(field in this.attributes) || this.attributes[field] == null) {
        throw new Error(`Missing required field '${field}' for ${this.constructor.name}`);
      }
    }
  }

  async save(): Promise<void> {
    this.validateAndApplyDefaults();

    const id = this.attributes[this.idField];
    if (!id) throw new Error(`Missing '${this.idField}' for save`);

    const document = this.attributes.document;
    if (!document || (Array.isArray(document) && !document.length)) {
      console.warn(`[ChromaBaseModel] Skipping save - no document content for ${this.constructor.name} id ${id}`);
      return;
    }

    // Check if embeddings are properly configured
    const embeddingCheck = this.validateEmbeddingConfiguration();
    if (!embeddingCheck.valid) {
      throw new Error(embeddingCheck.errorMessage);
    }

    // Safe metadata (flatten arrays/objects, stringify numbers)
    const safeMetadata = { ...this.attributes };
    delete safeMetadata.document;

    for (const [key, value] of Object.entries(safeMetadata)) {
      if (Array.isArray(value)) {
        safeMetadata[key] = value.join(', ');
      } else if (typeof value === 'object' && value !== null) {
        safeMetadata[key] = JSON.stringify(value);
      } else if (value === undefined) {
        safeMetadata[key] = null;
      } else if (typeof value === 'number') {
        safeMetadata[key] = String(value);
      }
    }

    console.log(`[ChromaBaseModel] Saving ${this.collectionName} id ${id}:`, safeMetadata);

    await chromaClient.addDocuments(
      this.collectionName,
      Array.isArray(document) ? document : [document],
      [safeMetadata],
      [String(id)] // ensure ID is string
    );
  }

  // ────────────────────────────────────────────────
  // Static helpers
  // ────────────────────────────────────────────────

  static async create<T extends ChromaBaseModel>(
    this: new (data?: Record<string, any>) => T,
    attributes: Record<string, any>
  ): Promise<T> {
    const instance = new this();
    instance.fill(attributes);
    await instance.save();
    return instance;
  }

  static async find<T extends ChromaBaseModel>(
    this: new (attributes?: Record<string, any>) => T,
    id: string
  ): Promise<T | null> {
    const instance = new this();
    const res = await chromaClient.getDocuments(instance.collectionName, [id]);

    if (!res?.ids?.length || !res.ids[0]) return null;

    const doc = {
      id: res.ids[0],
      document: res.documents?.[0] ?? '',
      metadata: res.metadatas?.[0] ?? {}
    };

    return new this(doc.metadata);
  }

  static async search<T extends ChromaBaseModel>(
    this: new (attributes?: Record<string, any>) => T,
    query: string,
    limit = 5,
    filter?: Record<string, any>
  ): Promise<T[]> {
    const instance = new this();
    const res = await chromaClient.queryDocuments(
      instance.collectionName,
      [query],
      limit,
      filter
    );

    if (!res?.ids?.[0]?.length) return [];

    return res.ids[0].map((id: string, idx: number) => {
      const metadata = res.metadatas?.[0]?.[idx] ?? {};
      return new this(metadata);
    });
  }

  async delete(): Promise<void> {
    const id = this.attributes[this.idField];
    if (!id) return;

    await chromaClient.deleteDocuments(this.collectionName, [String(id)]);
  }

  get attributesSnapshot(): Readonly<Record<string, any>> {
    return { ...this.attributes };
  }

  private validateEmbeddingConfiguration(): { valid: boolean; errorMessage?: string } {
    const mode = getModelMode();
    const remote = getRemoteConfig();

    // Check if mode is set to remote
    if (mode !== 'remote') {
      return {
        valid: false,
        errorMessage: `Knowledge Base requires embeddings to be configured. Current mode: "${mode}". Please set mode to "remote" in your AI settings.`
      };
    }

    // Check if provider is configured
    if (!remote?.provider) {
      return {
        valid: false,
        errorMessage: `Knowledge Base requires a remote embedding provider. Please configure a provider (OpenAI or xAI/Grok) in your AI settings.`
      };
    }

    const provider = remote.provider.toLowerCase();

    // Provider-specific validation
    if (provider === 'openai') {
      const apiKey = remote.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return {
          valid: false,
          errorMessage: `OpenAI embeddings require an API key. Please add your OpenAI API key in your AI settings or set OPENAI_API_KEY environment variable.`
        };
      }
    } else if (provider === 'grok' || provider === 'xai') {
      const apiKey = remote.apiKey || process.env.XAI_API_KEY;
      if (!apiKey) {
        return {
          valid: false,
          errorMessage: `xAI/Grok embeddings require an API key. Please add your xAI API key in your AI settings or set XAI_API_KEY environment variable.`
        };
      }
    } else {
      return {
        valid: false,
        errorMessage: `Unsupported embedding provider: "${remote.provider}". Please use "openai" or "xai"/"grok" in your AI settings.`
      };
    }

    return { valid: true };
  }
}