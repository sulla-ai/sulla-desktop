import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { resolveBridge, isBridgeResolved } from "./resolve_bridge";

/**
 * Get Page Snapshot Tool - Returns an actionable Markdown snapshot of the
 * currently active website asset (buttons, links, form fields).
 */
export class GetPageSnapshotWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const result = resolveBridge(input.assetId);
    if (!isBridgeResolved(result)) return result;

    try {
      const markdown = await result.bridge.getActionableMarkdown();
      if (!markdown.trim()) {
        return {
          successBoolean: true,
          responseString: `[${result.assetId}] Page snapshot is empty — the page may have no interactive elements.`,
        };
      }

      return {
        successBoolean: true,
        responseString: `[asset: ${result.assetId}]\n${markdown}`,
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error getting page snapshot: ${(error as Error).message}`,
      };
    }
  }
}

export const getPageSnapshotRegistration: ToolRegistration = {
  name: "get_page_snapshot",
  description: "Get an actionable Markdown snapshot of a website asset showing all visible buttons, links, and form fields with their handles. Omit assetId to target the active asset, or specify one from list_active_pages.",
  category: "playwright",
  operationTypes: ['read'],
  schemaDef: {
    assetId: { type: 'string' as const, optional: true, description: "Target asset ID (omit for the currently active website)" },
  },
  workerClass: GetPageSnapshotWorker,
};
