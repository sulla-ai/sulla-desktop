// src/models/Article.ts

import { VectorBaseModel } from '../VectorBaseModel';

export class Article extends VectorBaseModel {
  protected readonly collectionName = 'knowledgebase_articles';
  protected readonly idField = 'slug';

  protected readonly fillable = [
    'section',
    'category',
    'schemaversion',
    'slug',
    'title',
    'tags',
    'order',
    'locked',
    'author',
    'related_slugs',        // keep for legacy/flat
    'mentions',             // new: array of slugs/entities mentioned
    'related_entities',     // new: array of entity IDs/names
    'document',
  ];

  protected readonly required = [
    'schemaversion',
    'slug',
    'title',
    'document',
    'created_at',
    'updated_at',
  ];

  protected readonly defaults = {
    schemaversion: 1,
    tags: [],
    order: '100',
    locked: false,
    author: 'Jonathon Byrdziak',
    mentions: [],
    related_entities: [],
  };

  async save(): Promise<void> {
    // Set timestamps
    this.attributes.created_at = this.attributes.created_at || new Date().toISOString();
    this.attributes.updated_at = new Date().toISOString();

    // Call parent save
    await super.save();
  }
}