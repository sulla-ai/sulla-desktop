// src/database/VectorBaseModel.ts
import { Neo4jDB } from './Neo4jDB';
import { IVectorDatabase } from '../types';

interface VectorDocument {
  id: string;
  document: string;
  metadata: Record<string, any>;
}

export abstract class VectorBaseModel {
  protected abstract collectionName: string;
  protected abstract idField: string; // e.g. 'threadId' or 'slug'

  public static vectorDB: IVectorDatabase = new Neo4jDB();

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

  protected hydrate(data: Record<string, any>) {
    // Set all attributes from database data, bypassing fillable filter
    for (const [key, value] of Object.entries(data)) {
      this.attributes[key] = value;
      // Set as property only if no getter exists
      const descriptor = Object.getOwnPropertyDescriptor(this.constructor.prototype, key);
      if (!descriptor?.get) {
        (this as any)[key] = value;
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
      console.warn(`[VectorBaseModel] Skipping save - no document content for ${this.constructor.name} id ${id}`);
      return;
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

    console.log(`[VectorBaseModel] Saving ${this.collectionName} id ${id}:`, safeMetadata);

    // Chunk long documents to avoid context length limits
    const documentChunks = this.chunkDocument(document);
    const metadataChunks = documentChunks.map(() => safeMetadata);
    const idChunks = documentChunks.map((_, index) => `${String(id)}_${index}`);

    await VectorBaseModel.vectorDB.addDocuments(
      this.collectionName,
      documentChunks,
      metadataChunks,
      idChunks
    );

    // Handle graph relationships if attributes have them
    const session = await (VectorBaseModel.vectorDB as any).getSession();
    try {
      const tx = session.beginTransaction();

      // Clear old relationships (optional, or use MERGE)
      await tx.run(`
        MATCH (d:Document {id: $id})-[r:MENTIONS|RELATED_TO|KNOWS]->()
        DELETE r
      `, { id });

      // Add MENTIONS (example: from mentions array)
      if (this.attributes.mentions?.length) {
        for (const target of this.attributes.mentions) {
          await tx.run(`
            MATCH (d:Document {id: $id})
            MERGE (t:Document {id: $target})
            MERGE (d)-[:MENTIONS]->(t)
          `, { id, target });
        }
      }

      // Add RELATED_TO for entities
      if (this.attributes.related_entities?.length) {
        for (const entity of this.attributes.related_entities) {
          const entityId = typeof entity === 'string' ? entity : entity.id;
          await tx.run(`
            MATCH (d:Document {id: $id})
            MERGE (e:Entity {id: $entityId, name: $entityName})
            MERGE (d)-[:RELATED_TO]->(e)
          `, { 
            id, 
            entityId,
            entityName: typeof entity === 'string' ? entity : entity.name 
          });
        }
      }

      await tx.commit();
    } finally {
      await session.close();
    }
  }

  /**
   * Chunk a document into smaller pieces to avoid embedding model context limits
   * @param document The document content to chunk
   * @param maxChunkSize Maximum characters per chunk (default: 1000)
   * @param overlap Overlap between chunks in characters (default: 100)
   * @returns Array of document chunks
   */
  private chunkDocument(document: string | string[], maxChunkSize = 1000, overlap = 100): string[] {
    const content = Array.isArray(document) ? document.join('\n') : document;

    if (content.length <= maxChunkSize) {
      return [content];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < content.length) {
      let end = start + maxChunkSize;

      // If we're not at the end, try to find a good breaking point
      if (end < content.length) {
        // Look for sentence endings within the last 100 characters
        const lastPeriod = content.lastIndexOf('.', end);
        const lastNewline = content.lastIndexOf('\n', end);
        const lastSpace = content.lastIndexOf(' ', end);

        // Use the best breaking point found
        if (lastPeriod > end - 100) {
          end = lastPeriod + 1;
        } else if (lastNewline > end - 100) {
          end = lastNewline;
        } else if (lastSpace > end - 100) {
          end = lastSpace;
        }
      }

      const chunk = content.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      // Move start position with overlap
      start = Math.max(start + 1, end - overlap);
    }

    return chunks;
  }

  // ────────────────────────────────────────────────
  // Static helpers
  // ────────────────────────────────────────────────

  static async create<T extends VectorBaseModel>(
    this: new (data?: Record<string, any>) => T,
    attributes: Record<string, any>
  ): Promise<T> {
    const instance = new this();
    instance.fill(attributes);
    await instance.save();
    return instance;
  }

  static async find<T extends VectorBaseModel>(
    this: new (attributes?: Record<string, any>) => T,
    id: string
  ): Promise<T | null> {
    const instance = new this();
    console.log(`[VectorBaseModel] Finding ${instance.collectionName} id ${id}`);

    // First, try to find all chunks for this document
    const allChunkIds = await VectorBaseModel.findAllChunkIds(instance.collectionName, id);
    if (allChunkIds.length === 0) {
      console.log(`[VectorBaseModel] No document found for id ${id}`);
      return null;
    }

    const res = await VectorBaseModel.vectorDB.getDocuments(instance.collectionName, allChunkIds);
    console.log(`[VectorBaseModel] getDocuments result for ${allChunkIds.length} chunks:`, res);

    if (!res?.ids?.length) {
      console.log(`[VectorBaseModel] No chunks found for id ${id}`);
      return null;
    }

    // Sort chunks by their index and concatenate documents
    const sortedChunks = res.ids
      .map((chunkId: string, index: number) => ({
        id: chunkId,
        document: res.documents?.[index] ?? '',
        metadata: res.metadatas?.[index] ?? {},
        chunkIndex: VectorBaseModel.getChunkIndex(chunkId)
      }))
      .sort((a: any, b: any) => a.chunkIndex - b.chunkIndex);

    const concatenatedDocument = sortedChunks.map((chunk: any) => chunk.document).join(' ');
    const firstChunkMetadata = sortedChunks[0]?.metadata ?? {};

    console.log(`[VectorBaseModel] Retrieved ${sortedChunks.length} chunks, concatenated to ${concatenatedDocument.length} characters`);

    const resultInstance = new this();

    // Hydrate with metadata from the first chunk (bypasses fillable filter)
    resultInstance.hydrate(firstChunkMetadata);

    // Fill the document with the concatenated content
    resultInstance.fill({ document: concatenatedDocument });

    return resultInstance;
  }

  /**
   * Find all chunk IDs for a given document ID
   * @param collectionName The collection name to search in
   * @param baseId The base document ID (without chunk suffix)
   * @returns Array of chunk IDs
   */
  public static async findAllChunkIds(collectionName: string, baseId: string): Promise<string[]> {
    // First try the base ID (for non-chunked docs)
    const existingIds: string[] = [];
    try {
      const res = await VectorBaseModel.vectorDB.getDocuments(collectionName, [baseId]);
      if (res?.ids?.length && res.ids[0]) {
        existingIds.push(baseId);
        console.log(`[VectorBaseModel] Found base document ${baseId}`);
      }
    } catch (err) {
      // Base ID doesn't exist, continue
    }

    // If we found the base document, it might be non-chunked, so return it
    if (existingIds.length > 0) {
      return existingIds;
    }

    // Otherwise, look for chunks dynamically.
    // Scan a bounded range instead of stopping at the first miss so sparse
    // chunk sets (e.g. missing _0 after partial deletes) are still discoverable.
    let chunkIndex = 0;
    const maxChunks = 100; // Reasonable upper limit to prevent infinite loops

    while (chunkIndex < maxChunks) {
      const chunkId = `${baseId}_${chunkIndex}`;
      try {
        const res = await VectorBaseModel.vectorDB.getDocuments(collectionName, [chunkId]);
        if (res?.ids?.length && res.ids[0]) {
          existingIds.push(chunkId);
          console.log(`[VectorBaseModel] Found chunk ${chunkId}`);
        }
      } catch (err) {
        // Chunk doesn't exist, continue scanning bounded range
      }

      chunkIndex++;
    }

    console.log(`[VectorBaseModel] Found ${existingIds.length} chunks for ${baseId}`);
    return existingIds;
  }

  /**
   * Extract chunk index from chunk ID (e.g., "doc_0" -> 0, "doc" -> 0)
   * @param chunkId The chunk ID
   * @returns The chunk index
   */
  public static getChunkIndex(chunkId: string): number {
    const match = chunkId.match(/_(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  static async search<T extends VectorBaseModel>(
    this: new (attributes?: Record<string, any>) => T,
    query: string,
    limit = 5,
    filter?: Record<string, any>
  ): Promise<T[]> {
    const instance = new this();
    const res = await VectorBaseModel.vectorDB.queryDocuments(
      instance.collectionName,
      [query],
      limit,
      filter
    );

    if (!res || !res.length) return [];

    return res.map((result: any) => {
      const metadata = result.payload;
      const instance = new this();
      instance.hydrate(metadata);
      return instance;
    });
  }

  async delete(): Promise<void> {
    const id = this.attributes[this.idField];
    if (!id) return;

    const baseId = String(id);
    const chunkIds = await VectorBaseModel.findAllChunkIds(this.collectionName, baseId);
    const idsToDelete = Array.from(new Set([baseId, ...chunkIds]));

    await VectorBaseModel.vectorDB.deleteDocuments(
      this.collectionName,
      idsToDelete,
      { id: { $startsWith: `${baseId}_` } },
    );
  }

  get attributesSnapshot(): Readonly<Record<string, any>> {
    return { ...this.attributes };
  }
}
