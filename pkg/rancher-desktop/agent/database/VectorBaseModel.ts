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

    await VectorBaseModel.vectorDB.addDocuments(
      this.collectionName,
      Array.isArray(document) ? document : [document],
      [safeMetadata],
      [String(id)] // ensure ID is string
    );
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
    const res = await VectorBaseModel.vectorDB.getDocuments(instance.collectionName, [id]);
    console.log(`[VectorBaseModel] getDocuments result:`, res);

    if (!res?.ids?.length || !res.ids[0]) {
      console.log(`[VectorBaseModel] No document found for id ${id}`);
      return null;
    }

    const doc = {
      id: res.ids[0],
      document: res.documents?.[0] ?? '',
      metadata: res.metadatas?.[0] ?? {}
    };

    console.log(`[VectorBaseModel] Retrieved doc:`, doc);

    const resultInstance = new this();
    console.log(`[VectorBaseModel] Retrieved doc:`, doc);

    // Hydrate with metadata from database (bypasses fillable filter)
    resultInstance.hydrate(doc.metadata);

    // Fill the document since it's not in metadata
    resultInstance.fill({ document: doc.document });

    return resultInstance;
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

    if (!res?.ids?.[0]?.length) return [];

    return res.ids[0].map((id: string, idx: number) => {
      const metadata = res.metadatas?.[0]?.[idx] ?? {};
      const instance = new this();
      instance.hydrate(metadata);
      return instance;
    });
  }

  async delete(): Promise<void> {
    const id = this.attributes[this.idField];
    if (!id) return;

    await VectorBaseModel.vectorDB.deleteDocuments(this.collectionName, [String(id)]);
  }

  get attributesSnapshot(): Readonly<Record<string, any>> {
    return { ...this.attributes };
  }
}
