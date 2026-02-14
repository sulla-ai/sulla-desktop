// ArticlesRegistry.ts - Uses vector database for collection ops, Article model for single docs

import { Article } from '../models/Article';
import { VectorBaseModel } from '../VectorBaseModel';

export interface ArticleSearchOptions {
  query?: string;
  category?: string;
  section?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'title' | 'created_at' | 'updated_at' | 'order' | 'category';
  sortOrder?: 'asc' | 'desc';
}

export interface ArticleListItem {
  slug: string;
  title: string;
  category: string;
  section: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  author?: string;
  order?: string;
  locked?: boolean;
  excerpt: string;
  related_slugs?: string;
  mentions?: string;
  related_entities?: string;
}

export interface ArticleWithContent extends ArticleListItem {
  document: string;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

export class ArticlesRegistry {
  private static instance: ArticlesRegistry | null = null;
  private readonly collectionName = 'knowledgebase_articles';

  static getInstance(): ArticlesRegistry {
    return this.instance ?? (this.instance = new ArticlesRegistry());
  }

  private constructor() {}

  async search(options: ArticleSearchOptions = {}): Promise<SearchResult<ArticleListItem>> {
    try {
      const {
        query,
        category,
        section,
        tags,
        limit = 20,
        offset = 0,
        sortBy = 'updated_at',
        sortOrder = 'desc'
      } = options;

      // Build filter for vector database
      const filter: any = {};
      if (category) filter.category = { $eq: category };
      if (section) filter.section = { $eq: section };
      if (tags?.length) filter.tags = { $in: tags };

      const finalFilter = Object.keys(filter).length > 0 ? filter : undefined;
      console.log(`[ArticlesRegistry] Final filter:`, finalFilter);

      if (query?.trim()) {
        console.log(`[ArticlesRegistry] Performing semantic search for query: ${query}`);
        // Semantic search via vector database
        const result = await VectorBaseModel.vectorDB.queryDocuments(
          this.collectionName,
          [query],
          (limit + offset) * 2, // Get more results to account for deduplication
          finalFilter
        );
        console.log(`[ArticlesRegistry] Vector query result ids:`, result.ids?.length || 0);

        if (result?.ids?.[0]?.length) {
          console.log(`[ArticlesRegistry] Full result structure:`, JSON.stringify(result, null, 2));
          console.log(`[ArticlesRegistry] First few IDs:`, result.ids[0].slice(0, 5));
          
          // Group results by article slug to deduplicate (like sections/categories)
          const articleGroups = new Map<string, { score: number; index: number; metadata: any }>();

          console.log(`[ArticlesRegistry] Processing ${result.ids[0].length} chunks for deduplication:`);
          result.ids[0].forEach((id: string, idx: number) => {
            console.log(`[ArticlesRegistry] Processing chunk ID: "${id}"`);
            // Extract base slug (remove chunk suffix like _0, _1, etc.)
            const baseSlug = id.replace(/_\d+$/, '');
            const score = result.scores?.[0]?.[idx] || 0;

            console.log(`[ArticlesRegistry] Chunk "${id}" -> baseSlug "${baseSlug}", score ${score}`);

            // Keep only the highest-scoring chunk per article
            if (!articleGroups.has(baseSlug) || score > articleGroups.get(baseSlug)!.score) {
              articleGroups.set(baseSlug, {
                score,
                index: idx,
                metadata: result.metadatas?.[0]?.[idx] ?? {}
              });
              console.log(`[ArticlesRegistry] Set ${baseSlug} with score ${score}`);
            } else {
              console.log(`[ArticlesRegistry] Skipped ${baseSlug} - lower score`);
            }
          });

          console.log(`[ArticlesRegistry] Final article groups:`, Array.from(articleGroups.keys()));
          console.log(`[ArticlesRegistry] Deduplicated to ${articleGroups.size} unique articles from ${result.ids[0].length} chunks`);

          // Create deduplicated articles
          const articles: Article[] = await Promise.all(
            Array.from(articleGroups.entries()).map(async ([slug, { metadata }]) => {
              const article = new Article();
              article.fill({ ...metadata, slug });
              return article;
            })
          );

          console.log(`[ArticlesRegistry] Semantic search results: ${articles.length} unique articles (from ${result.ids[0].length} chunks)`);

          // Sort by relevance score and apply offset/limit
          articles.sort((a, b) => {
            const scoreA = articleGroups.get(a.attributes.slug)?.score || 0;
            const scoreB = articleGroups.get(b.attributes.slug)?.score || 0;
            return scoreB - scoreA; // Higher scores first
          });

          const slicedArticles = articles.slice(offset, offset + limit);
          const total = articleGroups.size; // Total unique articles
          const items = slicedArticles.map(a => this.toListItem(a));

          return {
            items,
            total,
            hasMore: offset + limit < total
          };
        } else {
          console.log(`[ArticlesRegistry] No semantic search results found`);
          return { items: [], total: 0, hasMore: false };
        }
      } else {
        console.log(`[ArticlesRegistry] Performing exact match search`);
        // Filter-only fetch via vector database
        const result = await VectorBaseModel.vectorDB.getDocuments(
          this.collectionName,
          [],
          finalFilter
        );
        console.log(`[ArticlesRegistry] Vector get result ids:`, result.ids?.length || 0);
        
        if (result?.ids?.length) {
          // Group results by article slug to deduplicate chunks (like sections/categories)
          const articleGroups = new Map<string, { index: number; metadata: any }>();

          console.log(`[ArticlesRegistry] Processing ${result.ids.length} results for deduplication:`);
          result.ids.forEach((id: string, idx: number) => {
            // Extract base slug (remove chunk suffix like _0, _1, etc.)
            const baseSlug = id.replace(/_\d+$/, '');
            console.log(`[ArticlesRegistry] Result "${id}" -> baseSlug "${baseSlug}"`);

            // For filter-only search, just keep the first occurrence of each article
            if (!articleGroups.has(baseSlug)) {
              articleGroups.set(baseSlug, {
                index: idx,
                metadata: result.metadatas?.[idx] ?? {}
              });
              console.log(`[ArticlesRegistry] Added ${baseSlug} to results`);
            } else {
              console.log(`[ArticlesRegistry] Skipped duplicate ${baseSlug}`);
            }
          });

          console.log(`[ArticlesRegistry] Deduplicated to ${articleGroups.size} unique articles from ${result.ids.length} results`);

          // Create deduplicated articles
          const articles: Article[] = Array.from(articleGroups.entries()).map(([slug, { metadata }]) => {
            const article = new Article();
            article.fill({ ...metadata, slug });
            return article;
          });

          const total = articleGroups.size;
          const items = articles.slice(offset, offset + limit).map(a => this.toListItem(a));

          return {
            items,
            total,
            hasMore: offset + limit < total
          };
        } else {
          return { items: [], total: 0, hasMore: false };
        }
      }
    } catch (err) {
      console.error(`Search ${this.collectionName} failed:`, err);
      throw err;
    }
  }

  async getBySlug(slug: string): Promise<ArticleWithContent | null> {
    console.log(`[ArticlesRegistry] getBySlug called with slug: ${slug}`);
    const article = await Article.find(slug);
    console.log(`[ArticlesRegistry] Article.find result:`, article);
    if (!article) {
      console.log(`[ArticlesRegistry] No article found for slug: ${slug}`);
      return null;
    }

    const result = {
      ...this.toListItem(article),
      document: article.attributes.document || ''
    };
    console.log(`[ArticlesRegistry] Returning ArticleWithContent:`, { ...result, document: result.document.substring(0, 100) + '...' });

    return result;
  }

  async getCategories(): Promise<string[]> {
    // Use vector database to fetch all articles and extract categories
    const result = await VectorBaseModel.vectorDB.getDocuments(this.collectionName, [], undefined);
    const cats = new Set<string>();
    result.metadatas.forEach((m: any) => m?.category && cats.add(m.category));
    return Array.from(cats).sort();
  }

  async getTags(): Promise<string[]> {
    // Use vector database to fetch all articles and extract tags
    const result = await VectorBaseModel.vectorDB.getDocuments(this.collectionName, [], undefined);
    const tags = new Set<string>();
    result.metadatas.forEach((m: any) => {
      let tagsArray: string[] = [];
      if (Array.isArray(m?.tags)) {
        tagsArray = m.tags;
      } else if (typeof m?.tags === 'string') {
        tagsArray = m.tags.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      tagsArray.forEach((t: string) => tags.add(t));
    });
    return Array.from(tags).sort();
  }

  async getNavStructure(): Promise<{ tag: string; pages: ArticleListItem[] }[]> {
    // Get all articles via vector database and group them by category
    const result = await VectorBaseModel.vectorDB.getDocuments(
      this.collectionName,
      [],
      undefined
    );

    const grouped = new Map<string, ArticleListItem[]>();

    // Group results by article slug to deduplicate chunks
    const articleGroups = new Map<string, { index: number; metadata: any }>();

    console.log(`[ArticlesRegistry] Processing ${result.ids.length} results for navigation deduplication:`);
    result.ids.forEach((id: string, idx: number) => {
      // Extract base slug (remove chunk suffix like _0, _1, etc.)
      const baseSlug = id.replace(/_\d+$/, '');
      console.log(`[ArticlesRegistry] Navigation result "${id}" -> baseSlug "${baseSlug}"`);

      // For navigation, just keep the first occurrence of each article
      if (!articleGroups.has(baseSlug)) {
        articleGroups.set(baseSlug, {
          index: idx,
          metadata: result.metadatas?.[idx] ?? {}
        });
        console.log(`[ArticlesRegistry] Added ${baseSlug} to navigation`);
      } else {
        console.log(`[ArticlesRegistry] Skipped duplicate navigation ${baseSlug}`);
      }
    });

    console.log(`[ArticlesRegistry] Navigation deduplicated to ${articleGroups.size} unique articles from ${result.ids.length} results`);

    // Create deduplicated articles for navigation
    Array.from(articleGroups.entries()).forEach(([slug, { metadata }]) => {
      const article = new Article();
      article.fill({ ...metadata, slug });

      // Parse tags
      let tagsArray: string[] = [];
      if (Array.isArray(article.attributes.tags)) {
        tagsArray = article.attributes.tags;
      } else if (typeof article.attributes.tags === 'string') {
        tagsArray = article.attributes.tags.split(',').map(s => s.trim()).filter(Boolean);
      }

      // Use section or category for navigation grouping, fallback to tags[0] or 'Uncategorized'
      const tag = article.attributes.section || article.attributes.category || tagsArray[0] || 'Uncategorized';

      if (!grouped.has(tag)) {
        grouped.set(tag, []);
      }
      grouped.get(tag)!.push(this.toListItem(article));
    });

    // Sort pages by order then title
    grouped.forEach(pages => {
      pages.sort((a, b) => {
        const oa = parseInt(a.order || '100', 10);
        const ob = parseInt(b.order || '100', 10);
        return oa !== ob ? oa - ob : a.title.localeCompare(b.title);
      });
    });

    return Array.from(grouped.entries())
      .map(([tag, pages]) => ({ tag, pages }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
  }

  async saveArticle(data: {
    slug: string;
    title: string;
    category: string;
    section?: string;
    tags?: string[];
    document: string;
    author?: string;
    order?: string;
    locked?: boolean;
  }): Promise<void> {
    await Article.create({
      slug: data.slug,
      title: data.title,
      category: data.category,
      section: data.section,
      tags: data.tags || [],
      document: data.document,
      author: data.author || 'Jonathon Byrdziak',
      order: data.order || '100',
      locked: data.locked ?? false
    });
  }

  async deleteArticle(slug: string): Promise<boolean> {
    const article = await Article.find(slug);
    if (!article) return false;

    await article.delete();
    return true;
  }

  async getRelated(slug: string, relType = 'MENTIONS', limit = 10) {
    const session = await (VectorBaseModel.vectorDB as any).getSession();
    const res = await session.run(`
      MATCH (d:Document {id: $slug})-[r:${relType}]->(target)
      RETURN target.id AS id, target.title AS title, labels(target)[0] AS type
      LIMIT $limit
    `, { slug, limit });
    return res.records.map((r: any) => r.toObject());
  }

  private toListItem(article: Article): ArticleListItem {
    const attrs = article.attributes;
    return {
      slug: attrs.slug || '',
      title: attrs.title || '',
      category: attrs.category || '',
      section: attrs.section || '',
      tags: Array.isArray(attrs.tags) ? attrs.tags : [],
      created_at: attrs.created_at || '',
      updated_at: attrs.updated_at || '',
      author: attrs.author,
      order: attrs.order,
      locked: attrs.locked,
      excerpt: attrs.document ? this.createExcerpt(attrs.document) : '',
      related_slugs: attrs.related_slugs,
      mentions: attrs.mentions,
      related_entities: attrs.related_entities,
    };
  }

  private createExcerpt(text: string, max = 250): string {
    if (!text) return '';
    // Simple approach: just take the first max characters and clean up whitespace
    const clean = text
      .replace(/\n+/g, ' ')  // Replace newlines with spaces
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();
    return clean.length > max ? clean.slice(0, max) + '...' : clean;
  }

  private sortItems(items: ArticleListItem[], sortBy: string, order: 'asc' | 'desc') {
    items.sort((a, b) => {
      let va: any = a[sortBy as keyof ArticleListItem] ?? '';
      let vb: any = b[sortBy as keyof ArticleListItem] ?? '';

      if (sortBy.includes('_at')) {
        va = new Date(va as string).getTime();
        vb = new Date(vb as string).getTime();
      }
      if (sortBy === 'order') {
        va = parseInt(va as string, 10) || 100;
        vb = parseInt(vb as string, 10) || 100;
      }

      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return order === 'asc' ? cmp : -cmp;
    });
  }
}

export const articlesRegistry = ArticlesRegistry.getInstance();