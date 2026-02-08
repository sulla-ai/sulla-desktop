// ChromaClient.ts — Singleton with configurable embeddings (OpenAI or xAI/Grok only)
// No dummy fallback, no Ollama/Xenova — just real providers

import { ChromaClient as BaseChromaClient, Metadata, Where, EmbeddingFunction } from 'chromadb';
import { OpenAIEmbeddings } from '@langchain/openai';

// Import your config service
import { getAgentConfig, getModelMode, getRemoteConfig, onConfigChange } from '../services/ConfigService';

// Adapter to bridge LangChain OpenAIEmbeddings with ChromaDB EmbeddingFunction
class OpenAIEmbeddingAdapter implements EmbeddingFunction {
  private embeddings: OpenAIEmbeddings;

  constructor(embeddings: OpenAIEmbeddings) {
    this.embeddings = embeddings;
  }

  async generate(texts: string[]): Promise<number[][]> {
    return await this.embeddings.embedDocuments(texts);
  }

  async generateForQueries(texts: string[]): Promise<number[][]> {
    return await Promise.all(texts.map(text => this.embeddings.embedQuery(text)));
  }
}

const CHROMA_BASE = 'http://127.0.0.1:30115';

// Provider-specific embedding models (only for OpenAI-compatible APIs)
const EMBEDDING_MODELS = {
  openai: 'text-embedding-3-small',
  grok: 'grok-embed-v1',
  xai: 'grok-embed-v1', // xAI uses same embedding model as Grok
} as const;

// Providers that support OpenAI-compatible embedding APIs
const EMBEDDING_SUPPORTED_PROVIDERS = new Set(['openai', 'grok', 'xai']);

class ChromaDB {
  private client: BaseChromaClient;
  private embeddingFunction: EmbeddingFunction | undefined;

  constructor() {
    console.log('[ChromaClient] Initializing ChromaDb client...');
    
    this.client = new BaseChromaClient({ path: CHROMA_BASE });
    console.log('[ChromaClient] Base client created with path:', CHROMA_BASE);

    this.initializeEmbeddings();

    // Subscribe to config changes to re-initialize embeddings when settings change
    onConfigChange((newConfig) => {
      console.log('[ChromaClient] Configuration changed, re-initializing embeddings...');
      console.log('[ChromaClient] New config:', newConfig);
      this.initializeEmbeddings();
    });
  }

  private initializeEmbeddings(): void {
    // Get full config to ensure we have all settings
    const agentConfig = getAgentConfig();
    
    const mode = agentConfig.modelMode;
    const remote = {
      provider: agentConfig.remoteProvider,
      model: agentConfig.remoteModel,
      apiKey: agentConfig.remoteApiKey,
      baseUrl: agentConfig.remoteBaseUrl
    };

    if (mode !== 'remote' || !remote.provider) {
      console.warn('[ChromaClient] Not in remote mode or no provider — embeddings disabled (ID ops only)');
      console.warn('[ChromaClient] mode:', mode, 'provider:', remote?.provider);
      this.embeddingFunction = undefined;
      return;
    }

    const provider = remote.provider.toLowerCase();
    console.log('[ChromaClient] Using provider:', provider);

    // Check if this provider supports embeddings
    if (!EMBEDDING_SUPPORTED_PROVIDERS.has(provider)) {
      console.warn(`[ChromaClient] Provider '${provider}' does not support OpenAI-compatible embeddings — embeddings disabled (ID ops only)`);
      this.embeddingFunction = undefined;
      return;
    }

    if (provider === 'openai') {
      console.log('[ChromaClient] Setting up OpenAI embeddings...');
      const apiKey = remote.apiKey || process.env.OPENAI_API_KEY;
      const embeddingModel = EMBEDDING_MODELS.openai;
      
      this.embeddingFunction = new OpenAIEmbeddingAdapter(new OpenAIEmbeddings({
        model: embeddingModel,
        openAIApiKey: apiKey!
      }));
      console.log('[ChromaClient] OpenAI embeddings configured successfully');
    } else if (provider === 'grok' || provider === 'xai') {
      console.log('[ChromaClient] Setting up xAI/Grok embeddings...');
      const apiKey = remote.apiKey || process.env.XAI_API_KEY;
      const embeddingModel = EMBEDDING_MODELS[provider as keyof typeof EMBEDDING_MODELS];
      
      this.embeddingFunction = new OpenAIEmbeddingAdapter(new OpenAIEmbeddings({
        model: embeddingModel,
        openAIApiKey: apiKey!,
        configuration: {
          baseURL: remote.baseUrl || 'https://api.x.ai/v1'
        }
      }));
      console.log('[ChromaClient] xAI embeddings configured successfully');
    } else {
      console.warn(`[ChromaClient] Unsupported provider '${provider}' — embeddings disabled`);
      console.warn('[ChromaClient] Supported providers: openai, grok, xai');
      this.embeddingFunction = undefined;
    }
    
    console.log('[ChromaClient] Initialization complete. Embeddings function:', !!this.embeddingFunction);
  }

  getClient(): BaseChromaClient {
    return this.client;
  }

  async initialize(): Promise<boolean> {
    try {
      await this.client.heartbeat();
      console.log('[ChromaClient] Connected');
      return true;
    } catch (err) {
      console.error('[ChromaClient] Connection failed:', err);
      return false;
    }
  }

  async getCollection(name: string) {
    try {
      return await this.client.getCollection({ name });
    } catch (err) {
      console.error(`Get collection ${name} failed:`, err);
      throw err;
    }
  }

  async getOrCreateCollection(name: string) {
    try {
      const options: any = { name };
      if (this.embeddingFunction) {
        options.embeddingFunction = this.embeddingFunction;
      }
      return await this.client.getOrCreateCollection(options);
    } catch (err) {
      console.error(`Get/Create ${name} failed:`, err);
      throw err;
    }
  }

  async listCollections() {
    try {
      return await this.client.listCollections();
    } catch (err) {
      console.error('List collections failed:', err);
      throw err;
    }
  }

  async deleteCollection(name: string) {
    try {
      return await this.client.deleteCollection({ name });
    } catch (err) {
      console.error(`Delete ${name} failed:`, err);
      throw err;
    }
  }

  async addDocuments(collectionName: string, documents: string[], metadatas?: Metadata[], ids?: string[]) {
    try {
      console.log(`[ChromaClient] addDocuments called for collection: ${collectionName}`);
      console.log(`[ChromaClient] Documents count: ${documents?.length || 0}`);
      console.log(`[ChromaClient] Embeddings function available: ${!!this.embeddingFunction}`);
      
      if (!Array.isArray(documents) || !documents.length) {
        console.warn('[ChromaClient] Invalid documents');
        return;
      }

      const collection = await this.getOrCreateCollection(collectionName);
      const addData: any = {
        ids: ids || documents.map((_, i) => `doc_${Date.now()}_${i}`),
        documents,
        metadatas
      };

      // Only add embeddings if embedding function is available
      if (this.embeddingFunction) {
        console.log('[ChromaClient] Generating embeddings for documents...');
        addData.embeddings = await this.embeddingFunction.generate(documents);
        console.log('[ChromaClient] Embeddings generated successfully');
      } else {
        console.warn('[ChromaClient] No embedding function available - adding documents without embeddings');
      }

      const result = await collection.add(addData);
      console.log(`[ChromaClient] Added ${documents.length} docs to ${collectionName}`);
      return result;
    } catch (err) {
      console.error(`Add to ${collectionName} failed:`, err);
      throw err;
    }
  }

  async queryDocuments(collectionName: string, queryTexts: string[], nResults = 5, where?: Where) {
    try {
      console.log(`[ChromaClient] queryDocuments called for collection: ${collectionName}`);
      console.log(`[ChromaClient] Query texts: ${queryTexts}`);
      console.log(`[ChromaClient] Embeddings function available: ${!!this.embeddingFunction}`);
      
      const collection = await this.getOrCreateCollection(collectionName);
      const queryData: any = {
        queryTexts,
        nResults,
        where
      };

      // Only add query embeddings if embedding function is available
      if (this.embeddingFunction) {
        console.log('[ChromaClient] Generating embeddings for query...');
        queryData.queryEmbeddings = await this.embeddingFunction.generate(queryTexts);
        console.log('[ChromaClient] Query embeddings generated successfully');
      } else {
        console.warn('[ChromaClient] No embedding function available - performing query without embeddings');
      }

      const result = await collection.query(queryData);
      console.log(`[ChromaClient] Queried ${collectionName} — ${result.ids.length} results`);
      return result;
    } catch (err) {
      console.error(`Query ${collectionName} failed:`, err);
      throw err;
    }
  }

  async getDocuments(collectionName: string, ids: string[], where?: Where) {
    try {
      const collection = await this.getOrCreateCollection(collectionName);
      return await collection.get({ ids, where });
    } catch (err) {
      console.error(`Get ${collectionName} failed:`, err);
      throw err;
    }
  }

  async updateDocuments(collectionName: string, ids: string[], documents?: string[], metadatas?: Metadata[]) {
    try {
      const collection = await this.getOrCreateCollection(collectionName);
      const updateData: any = { ids };

      if (documents) {
        updateData.documents = documents;
        // Only add embeddings if embedding function is available
        if (this.embeddingFunction) {
          updateData.embeddings = await this.embeddingFunction.generate(documents);
        }
      }

      if (metadatas) {
        updateData.metadatas = metadatas;
      }

      return await collection.update(updateData);
    } catch (err) {
      console.error(`Update ${collectionName} failed:`, err);
      throw err;
    }
  }

  async deleteDocuments(collectionName: string, ids?: string[], where?: Where) {
    try {
      const collection = await this.getCollection(collectionName);
      return await collection.delete({ ids, where });
    } catch (err) {
      console.error(`Delete ${collectionName} failed:`, err);
      throw err;
    }
  }

  async countDocuments(collectionName: string, where?: Where) {
    try {
      const collection = await this.getCollection(collectionName);
      if (where) {
        const results = await collection.get({ where });
        return results.ids.length;
      }
      return await collection.count();
    } catch (err) {
      console.error(`Count ${collectionName} failed:`, err);
      throw err;
    }
  }
}

// Singleton
export const chromaClient = new ChromaDB();
export { ChromaDB };