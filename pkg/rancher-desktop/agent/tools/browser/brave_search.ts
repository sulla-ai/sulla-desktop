import { BaseTool, ToolResponse } from "../base";
import { getIntegrationService } from '../../services/IntegrationService';

/**
 * Brave Search Tool - Worker class for execution
 */
export class BraveSearchWorker extends BaseTool {
  name: string = '';
  description: string = '';

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { query, count = 10 } = input;

    const integrationService = getIntegrationService();
    const apiKeyValue = await integrationService.getIntegrationValue('brave_search', 'api_key');
    if (!apiKeyValue) {
      return {
        successBoolean: false,
        responseString: "Error: Brave Search API key not configured."
      };
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
        return {
          successBoolean: false,
          responseString: `Brave Search API error: ${response.status} ${response.statusText}`
        };
      }

      const data = await response.json();

      if (!data.web?.results) {
        return {
          successBoolean: false,
          responseString: `No search results found for "${query}".`
        };
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
        successBoolean: true,
        responseString: `Found ${results.length} search results for "${query}" (total available: ${data.web.total || results.length}).`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error performing Brave search: ${(error as Error).message}`
      };
    }
  }
}
