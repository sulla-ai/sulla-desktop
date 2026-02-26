import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { resolveBridge, isBridgeResolved } from "./resolve_bridge";

/**
 * Wait For Element Tool - Waits for a CSS selector to become visible on a website asset.
 */
export class WaitForElementWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { selector, timeout = 5000 } = input;
    const result = resolveBridge(input.assetId);
    if (!isBridgeResolved(result)) return result;

    try {
      const found = await result.bridge.waitForSelector(selector, timeout);
      if (found) {
        return {
          successBoolean: true,
          responseString: `[${result.assetId}] Element matching "${selector}" is now visible.`,
        };
      }

      return {
        successBoolean: false,
        responseString: `[${result.assetId}] Timed out after ${timeout}ms waiting for "${selector}" to become visible.`,
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error waiting for element: ${(error as Error).message}`,
      };
    }
  }
}

export const waitForElementRegistration: ToolRegistration = {
  name: "wait_for_element",
  description: "Wait for a CSS selector to become visible on a website asset. Useful after clicking a button to wait for new content to appear. Omit assetId to target the active asset.",
  category: "playwright",
  operationTypes: ['read'],
  schemaDef: {
    selector: { type: 'string' as const, description: "CSS selector to wait for" },
    timeout: { type: 'number' as const, optional: true, default: 5000, description: "Maximum time to wait in milliseconds (default 5000)" },
    assetId: { type: 'string' as const, optional: true, description: "Target asset ID (omit for the currently active website)" },
  },
  workerClass: WaitForElementWorker,
};
