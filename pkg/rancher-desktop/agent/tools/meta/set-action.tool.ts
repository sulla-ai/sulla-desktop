import { BaseTool } from "../base";
import { z } from "zod";

export class SetActionTool extends BaseTool {
  name = "set_action";
  description = "Set the next action for the agent to take. This determines the flow in the graph.";
  schema = z.object({
    action: z.enum(["direct_answer", "ask_clarification", "use_tools", "create_plan", "run_again"]),
  });

  metadata = { category: "meta" };

  protected async _call(input: z.infer<this["schema"]>) {
    this.state!.metadata!.action = input.action;
    
    await this.emitProgressUpdate?.({
      type: "action_set",
      action: input.action
    });

    return { success: true, message: `Action set to ${input.action}` };
  }
}

import { toolRegistry } from '../registry';

toolRegistry.registerLazy('set_action', async () => new SetActionTool(), 'meta');
