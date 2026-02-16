import { BaseTool } from "../base";
import { getIntegrationService } from '../../services/IntegrationService';

// Define the registration type
type ToolRegistration = {
  name: string;
  description: string;
  category: string;
  schemaDef: any; // Using any for now, could be more specific
  workerClass: new () => BaseTool;
};

/**
 * Brave Search Tool - Worker class for execution
 */
export class BraveSearchWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any) {
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

// Export the complete tool registration with type enforcement
export const braveSearchRegistration: ToolRegistration = {
  name: "brave_search",
  description: "Search the web using Brave Search API for current and comprehensive results.",
  category: "browser",
  schemaDef: {
    query: { type: 'string' as const, description: "The search query to execute" },
    count: { type: 'number' as const, optional: true, default: 10, description: "Number of search results to return (max 20)" },
  },
  workerClass: BraveSearchWorker,
};
