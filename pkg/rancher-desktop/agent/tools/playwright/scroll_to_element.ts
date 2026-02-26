import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { resolveBridge, isBridgeResolved } from "./resolve_bridge";

/**
 * Scroll To Element Tool - Scrolls a matching element into view on a website asset.
 */
export class ScrollToElementWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { selector } = input;
    const result = resolveBridge(input.assetId);
    if (!isBridgeResolved(result)) return result;

    try {
      const scrolled = await result.bridge.scrollTo(selector);
      if (scrolled) {
        return {
          successBoolean: true,
          responseString: `[${result.assetId}] Scrolled to element matching "${selector}".`,
        };
      }

      return {
        successBoolean: false,
        responseString: `[${result.assetId}] Element not found: "${selector}".`,
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error scrolling to element: ${(error as Error).message}`,
      };
    }
  }
}

export const scrollToElementRegistration: ToolRegistration = {
  name: "scroll_to_element",
  description: "Scroll a matching element into view on a website asset using a CSS selector. Omit assetId to target the active asset.",
  category: "playwright",
  operationTypes: ['execute'],
  schemaDef: {
    selector: { type: 'string' as const, description: "CSS selector of the element to scroll into view" },
    assetId: { type: 'string' as const, optional: true, description: "Target asset ID (omit for the currently active website)" },
  },
  workerClass: ScrollToElementWorker,
};
