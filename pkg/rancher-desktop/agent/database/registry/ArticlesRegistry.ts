// ArticlesRegistry.ts - Uses ChromaDb for collection ops, Article model for single docs

import { Article } from '../models/Article';
import { chromaClient } from '../ChromaDb';

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

    // Build filter for ChromaDb
    const filter: any = {};
    if (category) filter.category = category;
    if (section) filter.section = section;
    if (tags?.length) filter.tags = { $in: tags };

    try {
      let articles: Article[] = [];

      if (query?.trim()) {
        // Semantic search via ChromaDb
        const result = await chromaClient.queryDocuments(
          this.collectionName,
          [query],
          limit + offset,
          filter
        );
        
        if (result?.ids?.[0]?.length) {
          articles = await Promise.all(result.ids[0].map(async (id: string, idx: number) => {
            const metadata = result.metadatas?.[0]?.[idx] ?? {};
            const article = new Article();
            article.fill({ ...metadata, slug: id });
            return article;
          }));
        }
      } else {
        // Filter-only fetch via ChromaDb
        const result = await chromaClient.getDocuments(
          this.collectionName,
          [],
          filter
        );
        
        if (result?.ids?.length) {
          articles = result.ids.map((id: string, idx: number): Article => {
            const metadata = result.metadatas?.[idx] ?? {};
            const article = new Article();
            article.fill({ ...metadata, slug: id });
            return article;
          });
        }
      }

      // Apply offset/limit
      articles = articles.slice(offset, offset + limit);

      // Sort in-memory if not relevance-sorted
      if (!query) {
        articles.sort((a, b) => {
          const va = a.attributes[sortBy] ?? '';
          const vb = b.attributes[sortBy] ?? '';
          const cmp = va < vb ? -1 : va > vb ? 1 : 0;
          return sortOrder === 'asc' ? cmp : -cmp;
        });
      }

      const total = await chromaClient.countDocuments(this.collectionName, filter);

      const items = articles.map(a => this.toListItem(a));

      return {
        items,
        total,
        hasMore: offset + limit < total
      };
    } catch (error) {
      console.error('[ArticlesRegistry] Search failed:', error);
      return { items: [], total: 0, hasMore: false };
    }
  }

  async getBySlug(slug: string): Promise<ArticleWithContent | null> {
    const article = await Article.find(slug);
    if (!article) return null;

    return {
      ...this.toListItem(article),
      document: article.attributes.document || ''
    };
  }

  async getCategories(): Promise<string[]> {
    // Use ChromaDb to fetch all articles and extract categories
    const result = await chromaClient.getDocuments(this.collectionName, [], undefined);
    const cats = new Set<string>();
    result.metadatas.forEach((m: any) => m?.category && cats.add(m.category));
    return Array.from(cats).sort();
  }

  async getTags(): Promise<string[]> {
    // Use ChromaDb to fetch all articles and extract tags
    const result = await chromaClient.getDocuments(this.collectionName, [], undefined);
    const tags = new Set<string>();
    result.metadatas.forEach((m: any) => {
      if (Array.isArray(m?.tags)) m.tags.forEach((t: string) => tags.add(t));
    });
    return Array.from(tags).sort();
  }

  async getNavStructure(): Promise<{ tag: string; pages: ArticleListItem[] }[]> {
    // Get all articles via ChromaDb and group them by category
    const result = await chromaClient.getDocuments(
      this.collectionName,
      [],
      undefined
    );

    const grouped = new Map<string, ArticleListItem[]>();

    result.ids.forEach((id: string, i: number) => {
      const metadata = result.metadatas[i];
      const article = new Article();
      article.fill({ ...metadata, slug: id });
      
      // Use tags[0] or section or category, fallback to 'Uncategorized'
      const tag = article.attributes.tags?.[0] || article.attributes.section || article.attributes.category || 'Uncategorized';
      
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
      excerpt: attrs.document ? this.createExcerpt(attrs.document) : ''
    };
  }

  private createExcerpt(text: string, max = 150): string {
    if (!text) return '';
    const clean = text
      .replace(/#{1,6}\s+/g, '')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/```[\s\S]*?```/g, '[code]')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n+/g, ' ')
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