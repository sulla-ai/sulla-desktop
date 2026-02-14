import { BaseTool } from "../base";
import { z } from "zod";
import DuckDuckGoService from 'ddgs';

export class DuckDuckGoSearchTool extends BaseTool {
  name = "duckduckgo_search";
  description = "Search the web using DuckDuckGo for privacy-focused and comprehensive results.";
  schema = z.object({
    query: z.string().describe("The search query to execute"),
    maxResults: z.number().optional().default(10).describe("Maximum number of search results to return"),
  });

  metadata = { category: "browser" };

  protected async _call(input: z.infer<this["schema"]>) {
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

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('duckduckgo_search', async () => new DuckDuckGoSearchTool(), 'browser');
