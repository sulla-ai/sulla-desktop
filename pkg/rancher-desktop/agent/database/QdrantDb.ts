// QdrantDb.ts — Qdrant vector database client

import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIEmbeddings } from '@langchain/openai';
import { OllamaEmbeddings } from '@langchain/ollama';
import { SullaSettingsModel } from './models/SullaSettingsModel';
import { IVectorDatabase } from '../types';

// Adapter to bridge LangChain OpenAIEmbeddings with Qdrant
class OpenAIEmbeddingAdapter {
  private embeddings: OpenAIEmbeddings;

  constructor(embeddings: OpenAIEmbeddings) {
    this.embeddings = embeddings;
  }

  async generate(texts: string[]): Promise<number[][]> {
    return this.embeddings.embedDocuments(texts);
  }

  async generateForQueries(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.embeddings.embedQuery(text)));
  }
}

// Adapter to bridge LangChain OllamaEmbeddings with Qdrant
class OllamaEmbeddingAdapter {
  private embeddings: OllamaEmbeddings;

  constructor(embeddings: OllamaEmbeddings) {
    this.embeddings = embeddings;
  }

  async generate(texts: string[]): Promise<number[][]> {
    return this.embeddings.embedDocuments(texts);
  }

  async generateForQueries(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.embeddings.embedQuery(text)));
  }
}

const EMBEDDING_MODELS = {
  openai: 'text-embedding-3-small',
} as const;

// Convert Chroma-style filter to Qdrant filter
function convertFilter(chromaFilter?: any): any {
  if (!chromaFilter) return undefined;
  
  const must = [];
  for (const [key, condition] of Object.entries(chromaFilter)) {
    if (condition && typeof condition === 'object') {
      if ('$eq' in condition) {
        must.push({ key, match: { value: condition.$eq } });
      } else if ('$in' in condition) {
        must.push({ key, match: { any: condition.$in } });
      }
      // Add more conditions as needed
    }
  }
  return must.length > 0 ? { must } : undefined;
}

// QdrantDB class for Qdrant vector database
export class QdrantDB implements IVectorDatabase {
  private client: QdrantClient;
  private embeddingFunction: OpenAIEmbeddingAdapter | OllamaEmbeddingAdapter | undefined;
  private initialized = false;
  private vectorSize = 768;

  constructor() {
    this.client = new QdrantClient({ url: 'http://127.0.0.1:6333' });
  }

  public async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initializeEmbeddings();
    }
    if (!this.embeddingFunction) {
      throw new Error('[QdrantDB] Embedding function not set after init');
    }
  }

  public async initializeEmbeddings(): Promise<void> {
    if (this.initialized) return;

    const mode = await SullaSettingsModel.get('modelMode', 'local');
    const remoteProvider = await SullaSettingsModel.get('remoteProvider', 'grok');
    const remoteModel = await SullaSettingsModel.get('remoteModel', 'grok-4-1-fast-reasoning');
    const remoteApiKey = await SullaSettingsModel.get('remoteApiKey', '');

    let ef: OpenAIEmbeddingAdapter | OllamaEmbeddingAdapter | undefined;

    if (mode === 'remote' && remoteProvider?.toLowerCase() === 'openai') {
      const apiKey = remoteApiKey || process.env.OPENAI_API_KEY;
      if (apiKey) {
        const model = EMBEDDING_MODELS.openai;
        ef = new OpenAIEmbeddingAdapter(new OpenAIEmbeddings({
          model,
          openAIApiKey: apiKey
        }));
        console.log('[QdrantDB] OpenAI embeddings ready');
      } else {
        console.warn('[QdrantDB] OpenAI key missing — fallback to Ollama');
      }
    }

    if (!ef) {
      // Ollama default
      ef = new OllamaEmbeddingAdapter(new OllamaEmbeddings({
        baseUrl: 'http://127.0.0.1:30114',
        model: 'nomic-embed-text'
      }));
      console.log('[QdrantDB] Ollama embeddings ready');
    }

    this.embeddingFunction = ef;
    this.vectorSize = ef instanceof OpenAIEmbeddingAdapter ? 1536 : 768;
    this.initialized = true;
  }

  async connect(): Promise<void> {
    // Test connection by listing collections
    await this.client.getCollections();
    console.log('[QdrantDB] Connected to Qdrant');
  }

  async createCollection(name: string, vectorSize: number = 384): Promise<void> {
    try {
      await this.client.createCollection(name, {
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      });
      console.log(`[QdrantDB] Created collection: ${name}`);
    } catch (err) {
      console.error(`[QdrantDB] Failed to create collection ${name}:`, err);
      throw err;
    }
  }

  async getOrCreateCollection(name: string): Promise<any> {
    try {
      const collection = await this.client.getCollection(name);
      // Check if vector size matches
      const collectionSize = collection.config?.params?.vectors?.size;
      if (collectionSize !== this.vectorSize) {
        throw new Error(`Collection '${name}' exists with vector size ${collectionSize}, but expected ${this.vectorSize}. Please delete the collection manually to recreate with correct size.`);
      }
      console.log(`[QdrantDB] Collection ${name} exists with correct vector size ${this.vectorSize}`);
      return collection;
    } catch (err: any) {
      if (err.message.includes('vector size')) {
        throw err; // Re-throw our custom error
      }
      // Collection doesn't exist, create it
      console.log(`[QdrantDB] Creating collection ${name} with vector size ${this.vectorSize}`);
      (this.client as any).createCollection(name, {
        vectors: {
          size: this.vectorSize,
          distance: 'Cosine',
        },
      });
      return await this.client.getCollection(name);
    }
  }

  async getCollection(name: string): Promise<any> {
    return await this.client.getCollection(name);
  }

  async deleteCollection(name: string): Promise<void> {
    try {
      await this.client.deleteCollection(name);
      console.log(`[QdrantDB] Deleted collection: ${name}`);
    } catch (err) {
      console.error(`[QdrantDB] Failed to delete collection ${name}:`, err);
      throw err;
    }
  }

  async clearCollection(name: string): Promise<void> {
    try {
      await this.client.delete(name, { filter: {} });
      console.log(`[QdrantDB] Cleared all points from collection: ${name}`);
    } catch (err) {
      console.error(`[QdrantDB] Failed to clear collection ${name}:`, err);
      throw err;
    }
  }

  async upsert(collectionName: string, points: { id: string | number; vector: number[]; payload?: any }[]): Promise<void> {
    try {
      await this.client.upsert(collectionName, {
        wait: true,
        points: points.map(p => ({
          id: p.id,
          vector: p.vector,
          payload: p.payload,
        })),
      });
      console.log(`[QdrantDB] Upserted ${points.length} points to ${collectionName}`);
    } catch (err) {
      console.error(`[QdrantDB] Failed to upsert to ${collectionName}:`, err);
      throw err;
    }
  }

  async getDocuments(collectionName: string, ids: string[], where?: any): Promise<any> {
    try {
      // If ids provided, use retrieve
      if (ids && ids.length > 0) {
        const result = await this.client.retrieve(collectionName, { 
          ids,
          with_payload: true,
          with_vector: false 
        });
        return {
          ids: result.map(p => p.id),
          documents: result.map(p => p.payload?.text || ''),
          metadatas: result.map(p => p.payload)
        };
      }
      
      // If no ids, use scroll with filter (for getting all with filter)
      const result = await this.client.scroll(collectionName, {
        filter: convertFilter(where),
        limit: 10000, // high limit
        with_payload: true,
        with_vector: false
      });
      return {
        ids: result.points.map(p => p.id),
        documents: result.points.map(p => p.payload?.text || ''),
        metadatas: result.points.map(p => p.payload)
      };
    } catch (err) {
      console.error(`[QdrantDB] Failed to get documents from ${collectionName}:`, err);
      throw err;
    }
  }

  async addDocuments(collectionName: string, documents: string[], metadatas?: any[], ids?: (string | number)[]): Promise<void> {
    await this.ensureInitialized();
    try {
      console.log(`[QdrantDB] addDocuments called for collection: ${collectionName}`);
      console.log(`[QdrantDB] Documents count: ${documents?.length || 0}`);
      console.log(`[QdrantDB] Embeddings function available: ${!!this.embeddingFunction}`);
      
      if (!Array.isArray(documents) || !documents.length) {
        console.warn('[QdrantDB] Invalid documents');
        return;
      }

      const collection = await this.getOrCreateCollection(collectionName);
      console.log(`[QdrantDB] Collection ${collectionName} ready`);
      const addData: any = {
        ids: ids || documents.map((_, i) => `doc_${Date.now()}_${i}`),
        documents,
        metadatas
      };

      // Only add embeddings if embedding function is available
      if (this.embeddingFunction) {
        console.log('[QdrantDB] Generating embeddings for documents...');
        addData.vectors = await this.embeddingFunction.generate(documents);
        console.log(`[QdrantDB] Generated ${addData.vectors.length} vectors, first vector length: ${addData.vectors[0]?.length}`);
        // Convert to Float32Array for Qdrant compatibility
        // addData.vectors = addData.vectors.map((v: number[]) => new Float32Array(v));
        console.log('[QdrantDB] Embeddings generated successfully');
      } else {
        console.warn('[QdrantDB] No embedding function available - cannot add documents without embeddings');
        return;
      }

      const points = addData.ids.map((id: string | number, i: number) => ({
        id,
        vector: addData.vectors[i],
        payload: {
          text: documents[i].substring(0, 1000),
          ...metadatas?.[i]
        }
      }));

      // Debug logging
      console.log('Points summary:', points.map((p: any) => ({
        id: p.id,
        vectorLength: p.vector.length,
        payloadKeys: Object.keys(p.payload),
        textLength: p.payload.text?.length || 0
      })));

      // Check for invalid vectors
      for (const p of points) {
        if (p.vector.some(isNaN) || p.vector.some((x: number) => !isFinite(x))) {
          console.error('Invalid vector found for id:', p.id, 'vector:', p.vector);
          throw new Error(`Vector for id ${p.id} contains invalid values (NaN or Infinity)`);
        }
        if (p.vector.length !== this.vectorSize) {
          console.error('Vector length mismatch for id:', p.id, 'expected:', this.vectorSize, 'got:', p.vector.length);
          throw new Error(`Vector length mismatch for id ${p.id}`);
        }
      }

      console.log('All vectors validated, proceeding to upsert');

      await this.upsert(collectionName, points);
    } catch (err) {
      console.error(`[QdrantDB] Add to ${collectionName} failed:`, err);
      throw err;
    }
  }

  async updateDocuments(collectionName: string, ids: string[], documents?: string[], metadatas?: any[]): Promise<any> {
    try {
      const collection = await this.getOrCreateCollection(collectionName);
      const updateData: any = { ids };

      if (documents) {
        updateData.documents = documents;
        // Only add embeddings if embedding function is available
        if (this.embeddingFunction) {
          updateData.vectors = await this.embeddingFunction.generate(documents);
        }
      }

      if (metadatas) {
        updateData.metadatas = metadatas;
      }

      // For Qdrant, update points
      if (documents && this.embeddingFunction) {
        const points = ids.map((id, i) => ({
          id,
          vector: updateData.vectors[i],
          payload: { text: documents[i], ...metadatas?.[i] }
        }));
        await this.upsert(collectionName, points);
      }
      return; // Qdrant doesn't return like Chroma
    } catch (err) {
      console.error(`[QdrantDB] Update ${collectionName} failed:`, err);
      throw err;
    }
  }

  async countDocuments(collectionName: string, where?: any): Promise<number> {
    try {
      // Approximate count using scroll with high limit
      const result = await this.client.scroll(collectionName, { limit: 1000000, with_payload: false, with_vector: false });
      return result.points.length;
    } catch (err) {
      console.error(`[QdrantDB] Count ${collectionName} failed:`, err);
      throw err;
    }
  }

  async deleteDocuments(collectionName: string, ids?: string[], where?: any): Promise<any> {
    try {
      if (ids && ids.length > 0) {
        await this.client.delete(collectionName, { points: ids });
      }
      console.log(`[QdrantDB] Deleted documents from ${collectionName}`);
    } catch (err) {
      console.error(`[QdrantDB] Delete documents from ${collectionName} failed:`, err);
      throw err;
    }
  }

  async queryDocuments(collectionName: string, queryTexts: string[], nResults = 5, where?: any): Promise<any> {
    await this.ensureInitialized();
    try {
      console.log(`[QdrantDB] queryDocuments called for collection: ${collectionName}`);
      console.log(`[QdrantDB] Query texts: ${queryTexts}`);
      console.log(`[QdrantDB] Embeddings function available: ${!!this.embeddingFunction}`);
      
      if (!this.embeddingFunction) {
        console.warn('[QdrantDB] No embedding function available - cannot search');
        return [];
      }

      console.log('[QdrantDB] Generating embedding for query...');
      const queryVectors = await this.embeddingFunction.generateForQueries(queryTexts);
      const queryVector = queryVectors[0]; // use first query text
      console.log('[QdrantDB] Query embedding generated successfully');

      const result = await this.client.search(collectionName, {
        vector: queryVector,
        limit: nResults || 5,
        with_payload: true,
        filter: convertFilter(where)
      });
      console.log(`[QdrantDB] Searched ${collectionName}, found ${result.length} results`);
      return result;
    } catch (err) {
      console.error(`[QdrantDB] Query ${collectionName} failed:`, err);
      throw err;
    }
  }

  async listCollections(): Promise<string[]> {
    try {
      const result = await this.client.getCollections();
      return result.collections.map(c => c.name);
    } catch (err) {
      console.error('[QdrantDB] Failed to list collections:', err);
      throw err;
    }
  }
}

console.log('QdrantDb.ts module loaded');
