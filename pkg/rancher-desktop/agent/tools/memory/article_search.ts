import { BaseTool, ToolResponse } from "../base";
import { ArticlesRegistry } from "../../database/registry/ArticlesRegistry";

type ScoredItem = {
  item: any;
  score: number;
  matchedPhrases: Set<string>;
};

/**
 * Article Search Tool - Worker class for execution
 */
export class ArticleSearchWorker extends BaseTool {
  name: string = '';
  description: string = '';

  private readonly stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'for', 'to', 'of', 'in', 'on', 'at',
    'with', 'by', 'from', 'my', 'our', 'your', 'workflow', 'project', 'please',
  ]);

  private normalizeText(value: string): string {
    return String(value || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private tokenize(value: string): string[] {
    return this.normalizeText(value)
      .split(' ')
      .map(token => token.trim())
      .filter(Boolean);
  }

  private buildSearchPhrases(query: string): string[] {
    const normalized = this.normalizeText(query);
    if (!normalized) return [];

    const phrases = new Set<string>();
    phrases.add(normalized);

    // split by separators first
    for (const piece of normalized.split(/[,:;|/]+/)) {
      const part = piece.trim();
      if (part.length >= 3) {
        phrases.add(part);
      }
    }

    const tokens = this.tokenize(normalized);
    const meaningfulTokens = tokens.filter(token => token.length > 2 && !this.stopWords.has(token));

    if (meaningfulTokens.length > 0) {
      phrases.add(meaningfulTokens.join(' '));
    }

    // add short n-grams to broaden recall
    for (let size = 2; size <= 4; size++) {
      for (let i = 0; i <= meaningfulTokens.length - size; i++) {
        const ngram = meaningfulTokens.slice(i, i + size).join(' ').trim();
        if (ngram.length >= 4) {
          phrases.add(ngram);
        }
      }
    }

    return Array.from(phrases)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .slice(0, 8);
  }

  private computeLexicalScore(item: any, phrase: string, originalQuery: string): number {
    const phraseNorm = this.normalizeText(phrase);
    const queryNorm = this.normalizeText(originalQuery);
    const title = this.normalizeText(item.title || '');
    const slug = this.normalizeText(item.slug || '');
    const excerpt = this.normalizeText(item.excerpt || '');
    const tags = Array.isArray(item.tags)
      ? item.tags.map((tag: string) => this.normalizeText(tag)).join(' ')
      : this.normalizeText(String(item.tags || ''));

    let score = 0;

    if (title.includes(phraseNorm)) score += 40;
    if (slug.includes(phraseNorm)) score += 30;
    if (excerpt.includes(phraseNorm)) score += 20;
    if (tags.includes(phraseNorm)) score += 16;

    if (queryNorm && title.includes(queryNorm)) score += 18;
    if (queryNorm && slug.includes(queryNorm)) score += 12;

    const phraseTokens = new Set(this.tokenize(phraseNorm));
    const searchableTokens = new Set(this.tokenize(`${title} ${slug} ${tags} ${excerpt}`));
    let overlap = 0;
    phraseTokens.forEach((token) => {
      if (searchableTokens.has(token)) overlap++;
    });
    if (phraseTokens.size > 0) {
      score += Math.round((overlap / phraseTokens.size) * 25);
    }

    return score;
  }

  private formatResponse(query: string, tag: string | undefined, phrases: string[], ranked: ScoredItem[], limit: number): string {
    let responseString = `Search results for "${query}"${tag ? ` (filtered by tag: ${tag})` : ''} (limit: ${limit}):\n`;
    responseString += `Expanded phrases used: ${phrases.join(' | ')}\n\n`;

    ranked.forEach((entry, index) => {
      const item = entry.item;
      responseString += `${index + 1}. Slug: ${item.slug}\n`;
      responseString += `   Title: ${item.title}\n`;
      responseString += `   Section: ${item.section || 'N/A'}\n`;
      responseString += `   Category: ${item.category || 'N/A'}\n`;
      responseString += `   Tags: ${Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags || 'None')}\n`;
      responseString += `   Relevance Score: ${entry.score}\n`;
      responseString += `   Matched Phrases: ${Array.from(entry.matchedPhrases).join(' | ')}\n`;
      responseString += `   Excerpt: ${item.excerpt || 'N/A'}\n\n`;
    });

    return responseString;
  }

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { query, limit = 5, tag } = input;

    try {
      const registry = ArticlesRegistry.getInstance();

      const phrases = this.buildSearchPhrases(query);
      if (phrases.length === 0) {
        return {
          successBoolean: false,
          responseString: `No articles found matching "${query}"${tag ? ` with tag "${tag}"` : ''}.`
        };
      }

      const perPhraseLimit = Math.max(8, Math.min(25, limit * 3));
      const aggregate = new Map<string, ScoredItem>();

      for (let phraseIndex = 0; phraseIndex < phrases.length; phraseIndex++) {
        const phrase = phrases[phraseIndex];
        const result = await registry.search({
          query: phrase,
          limit: perPhraseLimit,
          tags: tag ? [tag] : undefined,
        });

        result.items.forEach((item: any, itemIndex: number) => {
          const slug = String(item.slug || '').trim();
          if (!slug) return;

          const rankWeight = Math.max(1, (perPhraseLimit - itemIndex));
          const phrasePriorityWeight = Math.max(1, (phrases.length - phraseIndex));
          const lexical = this.computeLexicalScore(item, phrase, query);
          const combinedScore = (rankWeight * 4) + (phrasePriorityWeight * 3) + lexical;

          if (!aggregate.has(slug)) {
            aggregate.set(slug, {
              item,
              score: combinedScore,
              matchedPhrases: new Set([phrase]),
            });
            return;
          }

          const existing = aggregate.get(slug)!;
          const previousScore = existing.score;
          existing.score += combinedScore;
          existing.matchedPhrases.add(phrase);
          if (combinedScore > previousScore) {
            existing.item = item;
          }
        });
      }

      const ranked = Array.from(aggregate.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      if (ranked.length === 0) {
        return {
          successBoolean: false,
          responseString: `No articles found matching "${query}"${tag ? ` with tag "${tag}"` : ''}. Tried expanded phrases: ${phrases.join(' | ')}`,
        };
      }

      const responseString = this.formatResponse(query, tag, phrases, ranked, limit);

      return {
        successBoolean: true,
        responseString
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error searching articles: ${(error as Error).message}`
      };
    }
  }
}
