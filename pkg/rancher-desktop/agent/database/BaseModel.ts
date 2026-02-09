// src/database/BaseModel.ts

import { postgresClient } from './PostgresClient';
import type { QueryResultRow } from 'pg';

type WhereClause = Record<string, any>;

interface ModelAttributes {
  [key: string]: any;
}

/**
 * Abstract base class for database models providing common CRUD operations.
 * Subclasses must define tableName, primaryKey, and fillable/guarded fields.
 * Handles attribute filling, saving, querying, and basic validation. 
 */
export abstract class BaseModel<T extends ModelAttributes = ModelAttributes> {
  protected abstract tableName: string;
  protected abstract primaryKey: string; // usually 'id'
  protected fillable: string[] = [];     // fields allowed for mass assignment
  protected guarded: string[] = ['*'];   // protect all except fillable

  public attributes: Partial<T> = {};
  protected original: Partial<T> = {};
  protected exists = false;

  /**
   * Creates a new model instance with optional initial attributes.
   * 
   * @param attributes - Initial attributes to set on the model. 
   */
  constructor() {}

  /**
   * Fills the model with attributes using mass assignment rules.
   * Only fillable fields are allowed; guarded fields are protected.
   * 
   * @param attributes - Attributes to fill.
   * @throws Error if no fillable fields are defined and guarded is set to '*
   */
  public fill(attributes: Partial<T>) {
    // Get fillable from the instance prototype to handle minification
    const instance = this as any;
    const instanceFillable = instance.fillable || [];
    const instanceGuarded = instance.guarded || ['*'];
    
    if (instanceGuarded.includes('*') && instanceFillable.length === 0) {
      throw new Error('Model has no fillable fields defined');
    }

    for (const [key, value] of Object.entries(attributes)) {
      if (instanceFillable.includes(key) || !instanceGuarded.includes('*')) {
        (this.attributes as any)[key] = value;
      }
    }
  }

  /**
   * Updates the model's attributes using mass assignment rules.
  @param attributes - Attributes to update.
   */
  public updateAttributes(attributes: Partial<T>): void {
    this.fill(attributes);
  }

  /**
   * Finds a model instance by its primary key.
   * 
   * @param id - The primary key value (string or number).
   * @returns Promise resolving to the model instance or null if not found.
   */
  static async find<T extends BaseModel>(this: new (...args: any[]) => T, id: string | number): Promise<T | null> {
    const model = new this();
    const result = await postgresClient.queryOne(
      `SELECT * FROM ${model.tableName} WHERE "${model.primaryKey}" = $1 LIMIT 1`,
      [id]
    );

    if (!result) return null;

    const instance = new this(result);
    instance.exists = true;
    instance.original = { ...result };
    return instance;
  }

  /**
   * Retrieves all model instances from the database.
   * 
   * @returns Promise resolving to an array of model instances.
   */
  static async all<T extends BaseModel>(this: new (...args: any[]) => T): Promise<T[]> {
    const model = new (this as any)();
    const rows = await postgresClient.queryAll(
      `SELECT * FROM ${model.tableName} ORDER BY "${model.primaryKey}" ASC`
    );

    return rows.map(row => {
      const instance = new (this as any)(row);
      instance.exists = true;
      instance.original = { ...row };
      return instance;
    });
  }

  /**
   * Queries model instances based on conditions.
   * 
   * @param conditions - Either an object of key-value pairs for equality checks or a raw SQL string.
   * @param value - Optional value for raw SQL conditions.
   * @returns Promise resolving to an array of model instances.
   */
  static async where<T extends BaseModel>(
    this: new (...args: any[]) => T,
    conditions: WhereClause | string,
    value?: any
  ): Promise<T[]> {
    const model = new (this as any)();
    let query = `SELECT * FROM ${model.tableName}`;
    const params: any[] = [];

    if (typeof conditions === 'string') {
      query += ` WHERE ${conditions}`;
      if (value !== undefined) params.push(value);
    } else {
      const clauses = Object.entries(conditions).map(([k], i) => {
        params.push(conditions[k]);
        return `"${k}" = $${i + 1}`;
      });
      query += ` WHERE ${clauses.join(' AND ')}`;
    }

    const rows = await postgresClient.queryAll(query, params);

    return rows.map(row => {
      const instance = new (this as any)(row);
      instance.exists = true;
      instance.original = { ...row };
      return instance;
    });
  }

  /**
   * Creates and saves a new model instance with the given attributes.
   * 
   * @param attributes - Attributes for the new instance.
   * @returns Promise resolving to the saved model instance.
   */
  static async create<T extends BaseModel>(
    this: new () => T,
    attributes: Partial<ModelAttributes>
  ): Promise<T> {
    const model = new this();
    model.fill(attributes);
    return model.save();
  }

  /**
   * Saves the model instance to the database (insert or update).
   * Automatically handles created_at/updated_at timestamps.
   * 
   * @returns Promise resolving to the saved instance.
   * delete instance method:
   */
  async save(): Promise<this> {
    // Ensure fillable is properly initialized from instance
    const instanceFillable = this.fillable || [];
    const instanceGuarded = this.guarded || ['*'];
    
    if (this.exists) {
      // Update
      const changes = Object.entries(this.attributes)
        .filter(([k, v]) => this.original[k] !== v)
        .filter(([k]) => instanceFillable.includes(k) || !instanceGuarded.includes('*'));

      if (changes.length === 0) return this;

      const sets = changes.map(([k], i) => `"${k}" = $${i + 1}`).join(', ');
      const values = changes.map(([, v]) => v);
      values.push(this.attributes[this.primaryKey]);

      await postgresClient.query(
        `UPDATE ${this.tableName} SET ${sets}, "updated_at" = CURRENT_TIMESTAMP WHERE "${this.primaryKey}" = $${values.length}`,
        values
      );
    } else {
      // Insert
      const keys = Object.keys(this.attributes).filter(k => instanceFillable.includes(k) || !instanceGuarded.includes('*'));
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const values = keys.map(k => this.attributes[k]);

      const result = await postgresClient.query(
        `INSERT INTO ${this.tableName} (${keys.map(k => `"${k}"`).join(', ')}, "created_at", "updated_at") 
         VALUES (${placeholders}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        values
      );

      if (result[0]) {
        this.attributes = result[0];
        this.exists = true;
        this.original = { ...this.attributes };
      }
    }

    return this;
  }

  /**
   * Deletes the model instance from the database.
   * 
   * @returns Promise resolving to true if deleted, false if not exists
   */
  async delete(): Promise<boolean> {
    if (!this.exists) return false;

    const result = await postgresClient.query(
      `DELETE FROM ${this.tableName} WHERE "${this.primaryKey}" = $1`,
      [this.attributes[this.primaryKey]]
    );

    this.exists = false;
    return (result.length ?? 0) > 0;
  }

  /**
   * Gets the primary key value of the instance.
   * 
   * @returns The primary key value.
   */
  get id(): any {
    return this.attributes[this.primaryKey];
  }

  get attributesSnapshot(): Readonly<Partial<T>> {
    return { ...this.attributes };
  }
}