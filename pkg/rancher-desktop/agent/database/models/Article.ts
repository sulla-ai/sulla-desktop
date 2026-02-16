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

  /**
   * Find all articles matching a given metadata key-value pair
   */
  static async findByMetadata(metadataKey: string, metadataValue: string): Promise<Article[]> {
    const res = await VectorBaseModel.vectorDB.getDocuments(
      'knowledgebase_articles',
      [],
      { [metadataKey]: { $eq: metadataValue } }
    );

    if (!res?.ids?.length) return [];

    return res.ids.map((_: string, index: number) => {
      const article = new Article();
      article.hydrate(res.metadatas?.[index] ?? {});
      article.fill({ document: res.documents?.[index] ?? '' });
      return article;
    });
  }

  /**
   * Find all articles matching a given section value
   */
  static async findBySection(section: string): Promise<Article[]> {
    return this.findByMetadata('section', section);
  }

  /**
   * Find all articles tagged with a specific tag
   */
  static async findByTag(tag: string): Promise<Article[]> {
    // Since tags are stored as comma-separated strings, we need to query with a Cypher match
    const session = await (VectorBaseModel.vectorDB as any).getSession();
    try {
      const result = await session.run(`
        MATCH (d:Document)
        WHERE d.tags CONTAINS $tag
        RETURN d.id AS id, d.text AS text, d AS metadata
        ORDER BY d.created_at DESC
      `, { tag });

      if (!result.records?.length) return [];

      return result.records.map((record: any) => {
        const article = new Article();
        article.hydrate(record.get('metadata').properties);
        article.fill({ document: record.get('text') });
        return article;
      });
    } finally {
      await session.close();
    }
  }

  async save(): Promise<void> {
    // Set timestamps
    this.attributes.created_at = this.attributes.created_at || new Date().toISOString();
    this.attributes.updated_at = new Date().toISOString();

    // Call parent save
    await super.save();
  }
}