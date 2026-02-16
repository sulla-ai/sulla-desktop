import { BaseTool, ToolRegistration } from "../base";

/**
 * Trigger Subgraph Tool - Worker class for execution
 */
export class TriggerSubgraphWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { name, prompt } = input;

    // This tool just sets metadata flags that will be handled by the OverLordPlannerNode
    // The actual subgraph execution happens in the graph flow
    return {
      success: true,
      action: name,
      reasoning: prompt,
      message: `Triggered ${name} subgraph with instructions: ${prompt}`
    };
  }
}

// Export the complete tool registration with type enforcement
export const triggerSubgraphRegistration: ToolRegistration = {
  name: "trigger_subgraph",
  description: "Use this tool to trigger a full async subgraph process for complex tasks. This launches a hierarchical decision graph that thinks step-by-step, uses tools, spawns sub-agents, and runs the entire plan to completion. You only receive a clean summary back.",
  category: "meta",
  schemaDef: {
    name: { type: 'enum' as const, enum: ["review_and_plan", "work_on_memory_article"], description: "The type of subgraph to trigger" },
    prompt: { type: 'string' as const, description: "Detailed instructions for the subgraph process" },
  },
  workerClass: TriggerSubgraphWorker,
};
