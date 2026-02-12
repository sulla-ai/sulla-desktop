// src/models/Summary.ts
// Vector model for conversation_summaries collection
// Links thread_id to conversation table, searchable by topics/entities

import { VectorBaseModel } from '../VectorBaseModel';

export class Summary extends VectorBaseModel {
  protected collectionName = 'conversation_summaries';
  protected idField = 'threadId';

  protected fillable = [
    'threadId',
    'document',  // Changed from 'summary' to 'document' for VectorBaseModel
    'topics',
    'entities',
    'timestamp',
    'related_slugs',        // keep for legacy/flat
    'mentions',             // new: array of slugs/entities mentioned
    'related_entities',     // new: array of entity IDs/names
  ];

  protected required = [
    'threadId',
    'document',  // Changed from 'summary' to 'document'
    'topics',
    'timestamp',
  ];

  protected defaults = {
    topics: [],
    entities: [],
    // Removed 'conversationId: null' - not needed in vector metadata
  };

  // Convenience methods

  /** Search summaries by topic/entity */
  static async searchByTopicOrEntity(
    query: string, 
    limit = 5
  ): Promise<Summary[]> {
    const filter = {
      $or: [
        { topics: { $contains: query } },
        { entities: { $contains: query } }
      ]
    };
    return this.search(query, limit, filter);
  }

  /** Get summary for specific thread */
  static async findByThread(threadId: string): Promise<Summary | null> {
    return this.find(threadId);
  }

  /** Create summary from conversation data */
  static async createFromConversation(
    threadId: string,
    summaryText: string,
    topics: string[],
    entities: string[],
    conversationId?: number,  // Keep parameter for API compatibility but don't store in vector database
    relatedSlugs?: string[],
    mentions?: string[],
    relatedEntities?: string[]
  ): Promise<Summary> {
    const summaryDoc = `${summaryText}\n\nTopics: ${topics.join(', ')}\nEntities: ${entities.join(', ')}`;
    
    const summary = new Summary();
    summary.fill({
      threadId,
      document: summaryDoc,  // Changed from 'summary' to 'document'
      topics,
      entities,
      timestamp: Date.now(),
      related_slugs: relatedSlugs || [],
      mentions: mentions || [],
      related_entities: relatedEntities || [],
      // Removed conversationId - not stored in Chroma metadata
    });

    await summary.save();
    return summary;
  }

  // Getters
  get threadId(): string | undefined { return this.attributes.threadId; }
  get summary(): string | undefined { return this.attributes.document; }  // Now reads from 'document'
  get topics(): string[] { return this.attributes.topics ?? []; }
  get entities(): string[] { return this.attributes.entities ?? []; }
  get timestamp(): number | undefined { return this.attributes.timestamp; }
}