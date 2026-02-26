import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { resolveBridge, isBridgeResolved } from "./resolve_bridge";

/**
 * Get Page Text Tool - Returns the visible text content of a website asset.
 */
export class GetPageTextWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const result = resolveBridge(input.assetId);
    if (!isBridgeResolved(result)) return result;

    try {
      const title = await result.bridge.getPageTitle();
      const url = await result.bridge.getPageUrl();
      const text = await result.bridge.getPageText();

      if (!text.trim()) {
        return {
          successBoolean: true,
          responseString: `[${result.assetId}] Page "${title}" (${url}) has no visible text content.`,
        };
      }

      return {
        successBoolean: true,
        responseString: `[asset: ${result.assetId}]\n# ${title}\n**URL**: ${url}\n\n${text}`,
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error getting page text: ${(error as Error).message}`,
      };
    }
  }
}

export const getPageTextRegistration: ToolRegistration = {
  name: "get_page_text",
  description: "Get the visible text content (innerText) of a website asset, including the page title and URL. Omit assetId to target the active asset.",
  category: "playwright",
  operationTypes: ['read'],
  schemaDef: {
    assetId: { type: 'string' as const, optional: true, description: "Target asset ID (omit for the currently active website)" },
  },
  workerClass: GetPageTextWorker,
};
