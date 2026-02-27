import { BaseTool, ToolResponse } from "../base";
import DuckDuckGoService from 'ddgs';

/**
 * DuckDuckGo Search Tool - Worker class for execution
 */
export class DuckDuckGoSearchWorker extends BaseTool {
  name: string = '';
  description: string = '';
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { query, maxResults = 10 } = input;

    const ddg = new DuckDuckGoService();

    try {
      const { results } = await ddg.search(query);
      const limitedResults = results.slice(0, maxResults);

      if (!limitedResults || limitedResults.length === 0) {
        return {
          successBoolean: false,
          responseString: `No search results found for "${query}".`
        };
      }

      return {
        successBoolean: true,
        responseString: `Found ${limitedResults.length} search results for "${query}".`
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error performing DuckDuckGo search: ${(error as Error).message}`
      };
    } finally {
      await ddg.close();
    }
  }
}
