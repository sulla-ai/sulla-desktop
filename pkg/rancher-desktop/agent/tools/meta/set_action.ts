import { BaseTool, ToolRegistration } from "../base";

/**
 * Set Action Tool - Worker class for execution
 */
export class SetActionWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { action } = input;

    this.state!.metadata!.action = action;

    await this.emitProgressUpdate?.({
      type: "action_set",
      action: action
    });

    return { success: true, message: `Action set to ${action}` };
  }
}

// Export the complete tool registration with type enforcement
export const setActionRegistration: ToolRegistration = {
  name: "set_action",
  description: "Set the next action for the agent to take. This determines the flow in the graph.",
  category: "meta",
  schemaDef: {
    action: { type: 'enum' as const, enum: ["direct_answer", "ask_clarification", "use_tools", "create_plan", "run_again"] },
  },
  workerClass: SetActionWorker,
};
