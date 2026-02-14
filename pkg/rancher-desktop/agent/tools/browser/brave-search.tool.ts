import { BaseTool } from "../base";
import { z } from "zod";
import { getIntegrationService } from '../../services/IntegrationService';

export class BraveSearchTool extends BaseTool {
  name = "brave_search";
  description = "Search the web using Brave Search API for current and comprehensive results.";
  schema = z.object({
    query: z.string().describe("The search query to execute"),
    count: z.number().optional().default(10).describe("Number of search results to return (max 20)"),
  });

  metadata = { category: "browser" };

  protected async _call(input: z.infer<this["schema"]>) {
    const { query, count = 10 } = input;

    const integrationService = getIntegrationService();
    const apiKeyValue = await integrationService.getIntegrationValue('brave_search', 'api_key');
    if (!apiKeyValue) {
      return "Error: Brave Search API key not configured.";
    }

    const apiKey = apiKeyValue.value;

    try {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${Math.min(count, 20)}`;

      const response = await fetch(url, {
        headers: {
          'X-Subscription-Token': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.web?.results) {
        return `No search results found for "${query}".`;
      }

      const results = data.web.results.map((result: any, index: number) => ({
        rank: index + 1,
        title: result.title,
        url: result.url,
        description: result.description,
        language: result.language,
        family_friendly: result.family_friendly,
      }));

      return {
        query,
        total_results: data.web.total || results.length,
        results,
      };
    } catch (error) {
      return `Error performing Brave search: ${(error as Error).message}`;
    }
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('brave_search', async () => new BraveSearchTool(), 'browser');
