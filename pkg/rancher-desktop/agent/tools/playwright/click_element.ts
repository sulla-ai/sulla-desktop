import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { resolveBridge, isBridgeResolved } from "./resolve_bridge";

/**
 * Click Element Tool - Clicks a button, link, or element on a website asset.
 */
export class ClickElementWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { handle } = input;
    console.log('[SULLA_CLICK_TOOL] _validatedCall', { handle, assetId: input.assetId });
    const result = resolveBridge(input.assetId);
    if (!isBridgeResolved(result)) {
      console.log('[SULLA_CLICK_TOOL] bridge resolution failed', result);
      return result;
    }
    console.log('[SULLA_CLICK_TOOL] bridge resolved', { assetId: result.assetId, bridgeInjected: result.bridge.isInjected() });

    try {
      const clicked = await result.bridge.click(handle);
      console.log('[SULLA_CLICK_TOOL] bridge.click returned', { clicked, handle });
      if (clicked) {
        return {
          successBoolean: true,
          responseString: `[${result.assetId}] Successfully clicked element: ${handle}`,
        };
      }

      return {
        successBoolean: false,
        responseString: `[${result.assetId}] Element not found or not clickable: ${handle}. Use get_page_snapshot to see available elements.`,
      };
    } catch (error) {
      console.error('[SULLA_CLICK_TOOL] bridge.click threw', error);
      return {
        successBoolean: false,
        responseString: `Error clicking element: ${(error as Error).message}`,
      };
    }
  }
}

export const clickElementRegistration: ToolRegistration = {
  name: "click_element",
  description: "Click a button, link, or interactive element on a website asset. Use handles from get_page_snapshot (e.g. @btn-save, @link-home) or a CSS selector or data-test-id. Omit assetId to target the active asset.",
  category: "playwright",
  operationTypes: ['execute'],
  schemaDef: {
    handle: { type: 'string' as const, description: "The element handle (@btn-<slug>, @link-<slug>, data-test-id, or CSS selector)" },
    assetId: { type: 'string' as const, optional: true, description: "Target asset ID (omit for the currently active website)" },
  },
  workerClass: ClickElementWorker,
};
