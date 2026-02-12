// Neo4jDB.ts — Neo4j client implementing IVectorDatabase
// Uses native vector indexes + graph nodes for documents/entities

import neo4j, { Driver, Session, Integer } from 'neo4j-driver';
import { OpenAIEmbeddings } from '@langchain/openai';
import { OllamaEmbeddings } from '@langchain/ollama';
import { SullaSettingsModel } from './models/SullaSettingsModel';
import { IVectorDatabase } from '../types';

const EMBEDDING_MODELS = {
  openai: 'text-embedding-3-small',
} as const;

class OpenAIEmbeddingAdapter {
  private embeddings: OpenAIEmbeddings;
  constructor(embeddings: OpenAIEmbeddings) { this.embeddings = embeddings; }
  async generate(texts: string[]): Promise<number[][]> { return this.embeddings.embedDocuments(texts); }
  async generateForQueries(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embeddings.embedQuery(t)));
  }
}

class OllamaEmbeddingAdapter {
  private embeddings: OllamaEmbeddings;
  constructor(embeddings: OllamaEmbeddings) { this.embeddings = embeddings; }
  async generate(texts: string[]): Promise<number[][]> { return this.embeddings.embedDocuments(texts); }
  async generateForQueries(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embeddings.embedQuery(t)));
  }
}

export class Neo4jDB implements IVectorDatabase {
  private driver: Driver;
  private embeddingFunction: OpenAIEmbeddingAdapter | OllamaEmbeddingAdapter | undefined;
  private initialized = false;
  private vectorSize = 768;
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  constructor() {
    this.driver = neo4j.driver(
      'bolt://127.0.0.1:7687',
      neo4j.auth.basic('neo4j', 'yourpassword'), // ← change password
      {
        // Enable automatic reconnection
        connectionAcquisitionTimeout: 60000, // 60 seconds
        connectionTimeout: 30000, // 30 seconds
        maxConnectionPoolSize: 50,
        maxConnectionLifetime: 3600000, // 1 hour
        connectionLivenessCheckTimeout: 10000, // 10 seconds
      }
    );
  }

  private async withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        const isConnectionError = error.message?.includes('Connection was closed by server') ||
                                  error.message?.includes('connection') ||
                                  error.code === 'ECONNREFUSED' ||
                                  error.code === 'ENOTFOUND';

        if (!isConnectionError || attempt === this.maxRetries) {
          throw error;
        }

        console.warn(`[Neo4jDB] ${operationName} failed (attempt ${attempt}/${this.maxRetries}), retrying in ${this.retryDelay * attempt}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }

    throw lastError;
  }

  async ensureInitialized(): Promise<void> {
    if (!this.initialized) await this.initializeEmbeddings();
    if (!this.embeddingFunction) throw new Error('[Neo4jDB] Embedding function missing');
  }

  async initializeEmbeddings(): Promise<void> {
    const mode = await SullaSettingsModel.get('modelMode', 'local');
    const remoteProvider = await SullaSettingsModel.get('remoteProvider', 'grok');
    const remoteApiKey = await SullaSettingsModel.get('remoteApiKey', '');

    let ef: OpenAIEmbeddingAdapter | OllamaEmbeddingAdapter | undefined;

    if (mode === 'remote' && remoteProvider?.toLowerCase() === 'openai') {
      const apiKey = remoteApiKey || process.env.OPENAI_API_KEY;
      if (apiKey) {
        ef = new OpenAIEmbeddingAdapter(new OpenAIEmbeddings({
          model: EMBEDDING_MODELS.openai,
          openAIApiKey: apiKey
        }));
        this.vectorSize = 1536;
      }
    }

    if (!ef) {
      ef = new OllamaEmbeddingAdapter(new OllamaEmbeddings({
        baseUrl: 'http://127.0.0.1:30114',
        model: 'nomic-embed-text'
      }));
      this.vectorSize = 768;
    }

    this.embeddingFunction = ef;
    this.initialized = true;
  }

  private async getSession(): Promise<Session> {
    return this.driver.session();
  }

  async connect(): Promise<void> {
    const session = await this.getSession();
    try {
      await session.run('RETURN 1');
      console.log('[Neo4jDB] Connected');
    } finally {
      await session.close();
    }
  }

  async createCollection(name: string): Promise<void> {
    const session = await this.getSession();
    try {
      await session.run(`
        CREATE CONSTRAINT document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE;
        CREATE VECTOR INDEX ${name}_vector IF NOT EXISTS
        FOR (d:Document) ON (d.embedding)
        OPTIONS {indexProvider: 'vector-2.0', indexConfig: { 'vector.dimensions': ${this.vectorSize}, 'vector.similarity_function': 'cosine' }};
      `);
      console.log(`[Neo4jDB] Collection ${name} ready (vector index created)`);
    } finally {
      await session.close();
    }
  }

  async getOrCreateCollection(name: string): Promise<any> {
    await this.createCollection(name);
    return { name }; // dummy object to match interface
  }

  async getCollection(name: string): Promise<any> {
    return { name };
  }

  async deleteCollection(name: string): Promise<void> {
    const session = await this.getSession();
    try {
      await session.run(`MATCH (n:Document) DETACH DELETE n`);
      await session.run(`DROP INDEX ${name}_vector IF EXISTS`);
      console.log(`[Neo4jDB] Cleared ${name}`);
    } finally {
      await session.close();
    }
  }

  async addDocuments(collectionName: string, documents: string[], metadatas: any[] = [], ids: string[] = []): Promise<void> {
    await this.ensureInitialized();

    const vectors = await this.embeddingFunction!.generate(documents);

    await this.withRetry(async () => {
      const session = await this.getSession();
      try {
        const tx = session.beginTransaction();
        for (let i = 0; i < documents.length; i++) {
          const id = ids[i] || `doc_${Date.now()}_${i}`;
          const payload = metadatas[i] || {};
          payload.text = documents[i];

          await tx.run(`
            MERGE (d:Document {id: $id})
            SET d.text = $text,
                d.embedding = $embedding,
                d += $metadata
          `, {
            id,
            text: documents[i],
            embedding: vectors[i],
            metadata: payload
          });
        }
        await tx.commit();
        console.log(`[Neo4jDB] Added ${documents.length} documents`);
      } finally {
        await session.close();
      }
    }, 'addDocuments');
  }

  async queryDocuments(collectionName: string, queryTexts: string[], nResults = 5, where?: any): Promise<any> {
    await this.ensureInitialized();

    const queryVectors = await this.embeddingFunction!.generateForQueries(queryTexts);
    const queryVector = queryVectors[0];

    return this.withRetry(async () => {
      const session = await this.getSession();
      try {
        const result = await session.run(`
          CALL db.index.vector.queryNodes('${collectionName}_vector', $limit, $queryVector)
          YIELD node, score
          RETURN node.id AS id,
                 node.text AS text,
                 node AS metadata,
                 score
          ORDER BY score DESC
          LIMIT $limit
        `, { queryVector, limit: nResults });

        return result.records.map(r => ({
          id: r.get('id'),
          score: r.get('score'),
          payload: r.get('metadata').properties
        }));
      } finally {
        await session.close();
      }
    }, 'queryDocuments');
  }

  async getDocuments(collectionName: string, ids: string[], where?: any): Promise<any> {
    return this.withRetry(async () => {
      const session = await this.getSession();
      try {
        let query = `
          MATCH (d:Document)
        `;
        const params: any = {};

        // Handle ids filter
        if (ids && ids.length > 0) {
          query += ` WHERE d.id IN $ids`;
          params.ids = ids;
        }

        // Handle where filter
        if (where) {
          const whereConditions: string[] = [];
          for (const [key, condition] of Object.entries(where)) {
            if (condition && typeof condition === 'object' && '$eq' in condition) {
              whereConditions.push(`d.${key} = $${key}`);
              params[key] = condition.$eq;
            }
            // Add more conditions as needed (e.g., $in, $gt, etc.)
          }
          if (whereConditions.length > 0) {
            query += ids && ids.length > 0 ? ' AND ' : ' WHERE ';
            query += whereConditions.join(' AND ');
          }
        }

        query += `
          RETURN d.id AS id, d.text AS text, d AS metadata
        `;

        const result = await session.run(query, params);

        return {
          ids: result.records.map(r => r.get('id')),
          documents: result.records.map(r => r.get('text')),
          metadatas: result.records.map(r => r.get('metadata').properties)
        };
      } finally {
        await session.close();
      }
    }, 'getDocuments');
  }

  async updateDocuments(collectionName: string, ids: string[], documents?: string[], metadatas?: any[]): Promise<any> {
    await this.ensureInitialized();

    const vectors = documents ? await this.embeddingFunction!.generate(documents) : undefined;

    const session = await this.getSession();
    try {
      const tx = session.beginTransaction();
      for (let i = 0; i < ids.length; i++) {
        const params: any = { id: ids[i] };
        if (documents) {
          params.text = documents[i];
          params.embedding = vectors![i];
        }
        if (metadatas?.[i]) params.metadata = metadatas[i];

        await tx.run(`
          MATCH (d:Document {id: $id})
          SET d += $metadata
          ${documents ? 'SET d.text = $text, d.embedding = $embedding' : ''}
        `, params);
      }
      await tx.commit();
    } finally {
      await session.close();
    }
  }

  async countDocuments(collectionName: string, where?: any): Promise<number> {
    const session = await this.getSession();
    try {
      const result = await session.run(`MATCH (d:Document) RETURN count(d) AS count`);
      return (result.records[0].get('count') as Integer).toNumber();
    } finally {
      await session.close();
    }
  }

  async deleteDocuments(collectionName: string, ids?: string[], where?: any): Promise<any> {
    const session = await this.getSession();
    try {
      if (ids?.length) {
        await session.run(`MATCH (d:Document) WHERE d.id IN $ids DETACH DELETE d`, { ids });
      }
    } finally {
      await session.close();
    }
  }

  async listCollections(): Promise<string[]> {
    return ['documents']; // Neo4j doesn't have collections; simulate
  }

  async close(): Promise<void> {
    await this.driver.close();
  }
}