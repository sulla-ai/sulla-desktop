// src/models/Article.ts

import { ChromaBaseModel } from '../ChromaBaseModel';

export class Article extends ChromaBaseModel {
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
    'related_slugs',
    'document',
    'created_at',
    'updated_at',
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
  };
}