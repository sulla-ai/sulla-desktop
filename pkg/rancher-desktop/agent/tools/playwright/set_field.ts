import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { resolveBridge, isBridgeResolved } from "./resolve_bridge";

/**
 * Set Field Tool - Sets the value of a form field on a website asset.
 */
export class SetFieldWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { handle, value } = input;
    const result = resolveBridge(input.assetId);
    if (!isBridgeResolved(result)) return result;

    try {
      const success = await result.bridge.setValue(handle, value);
      if (success) {
        return {
          successBoolean: true,
          responseString: `[${result.assetId}] Successfully set field ${handle} to "${value}"`,
        };
      }

      return {
        successBoolean: false,
        responseString: `[${result.assetId}] Field not found: ${handle}. Use get_page_snapshot to see available form fields.`,
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error setting field value: ${(error as Error).message}`,
      };
    }
  }
}

export const setFieldRegistration: ToolRegistration = {
  name: "set_field",
  description: "Set the value of a form field (input, textarea, select) on a website asset. Use handles from get_page_snapshot (e.g. @field-email, @field-username). Omit assetId to target the active asset.",
  category: "playwright",
  operationTypes: ['update'],
  schemaDef: {
    handle: { type: 'string' as const, description: "The field handle (@field-<id|name>) or element id/name" },
    value: { type: 'string' as const, description: "The value to set" },
    assetId: { type: 'string' as const, optional: true, description: "Target asset ID (omit for the currently active website)" },
  },
  workerClass: SetFieldWorker,
};
