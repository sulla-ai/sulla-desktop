import { BaseTool, ToolRegistration } from "../base";
import DuckDuckGoService from 'ddgs';

/**
 * DuckDuckGo Search Tool - Worker class for execution
 */
export class DuckDuckGoSearchWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { query, maxResults = 10 } = input;

    const ddg = new DuckDuckGoService();

    try {
      const { results } = await ddg.search(query);
      const limitedResults = results.slice(0, maxResults);

      if (!limitedResults || limitedResults.length === 0) {
        return `No search results found for "${query}".`;
      }

      return {
        query,
        results: limitedResults.map((result: any, index: number) => ({
          rank: index + 1,
          title: result.title,
          url: result.url,
          description: result.description || result.body || '',
          hostname: result.hostname,
        })),
      };
    } catch (error) {
      return `Error performing DuckDuckGo search: ${(error as Error).message}`;
    } finally {
      await ddg.close();
    }
  }
}

// Export the complete tool registration with type enforcement
export const duckDuckGoSearchRegistration: ToolRegistration = {
  name: "duckduckgo_search",
  description: "Search the web using DuckDuckGo for privacy-focused and comprehensive results.",
  category: "browser",
  schemaDef: {
    query: { type: 'string' as const, description: "The search query to execute" },
    maxResults: { type: 'number' as const, optional: true, default: 10, description: "Maximum number of search results to return" },
  },
  workerClass: DuckDuckGoSearchWorker,
};
