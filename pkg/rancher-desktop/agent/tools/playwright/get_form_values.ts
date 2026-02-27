import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { resolveBridge, isBridgeResolved } from "./resolve_bridge";

/**
 * Get Form Values Tool - Returns all visible form field values from a website asset.
 */
export class GetFormValuesWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const result = resolveBridge(input.assetId);
    if (!isBridgeResolved(result)) return result;

    try {
      const values = await result.bridge.getFormValues();
      const entries = Object.entries(values);
      if (entries.length === 0) {
        return {
          successBoolean: true,
          responseString: `[${result.assetId}] No visible form fields found on the page.`,
        };
      }

      const lines = entries.map(([key, val]) => `- **@field-${key}** = "${val}"`);
      return {
        successBoolean: true,
        responseString: `[asset: ${result.assetId}]\n## Form Field Values (${entries.length} fields)\n${lines.join('\n')}`,
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error getting form values: ${(error as Error).message}`,
      };
    }
  }
}

export const getFormValuesRegistration: ToolRegistration = {
  name: "get_form_values",
  description: "Get a map of all visible form field values (inputs, textareas, selects) from a website asset. Omit assetId to target the active asset.",
  category: "playwright",
  operationTypes: ['read'],
  schemaDef: {
    assetId: { type: 'string' as const, optional: true, description: "Target asset ID (omit for the currently active website)" },
  },
  workerClass: GetFormValuesWorker,
};
