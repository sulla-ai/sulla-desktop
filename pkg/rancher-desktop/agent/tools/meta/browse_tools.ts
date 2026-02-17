import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { toolRegistry } from "../registry";

/**
 * Browse Tools Tool - Worker class for execution
 */
export class BrowseToolsWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { category, query } = input;

    const tools = await toolRegistry.searchTools(query, category);

    if (tools.length === 0) {
      return {
        successBoolean: false,
        responseString: `No tools found${category ? ` in category "${category}"` : ""}${query ? ` matching "${query}"` : ""}.\n\nAvailable categories: ${toolRegistry.getCategories().join(", ")}`
      }
    }

    // Attach found tools to state for LLM access
    if (this.state) {
      // Accumulate found tools (append to existing)
      const existingFoundTools = (this.state as any).foundTools || [];
      (this.state as any).foundTools = [...existingFoundTools, ...tools];

      // Accumulate LLM tools: ensure meta tools are included + append new found tools (avoid duplicates)
      const existingLLMTools = (this.state as any).llmTools || [];
      const metaTools = await toolRegistry.getLLMToolsForCategory("meta")();
      const newLLMTools = await Promise.all(tools.map(tool => toolRegistry.convertToolToLLM(tool.name)));
      
      // Combine all tools, avoiding duplicates by function name
      const allTools = [...metaTools, ...existingLLMTools, ...newLLMTools];
      const uniqueTools = allTools.filter((tool, index, arr) => 
        arr.findIndex(t => t.function?.name === tool.function?.name) === index
      );
      
      (this.state as any).llmTools = uniqueTools;
    }

    return {
      successBoolean: true,
      responseString: `Found ${tools.length} tools${category ? ` in category "${category}"` : ""}${query ? ` matching "${query}"` : ""}.`
    };
  }
}

// Export the complete tool registration with type enforcement
export const browseToolsRegistration: ToolRegistration = {
  name: "browse_tools",
  description: "List available tools by category or search term. Use this when you need a tool but don't know its exact name or category yet.",
  category: "meta",
  schemaDef: {
    category: { type: 'enum' as const, enum: ["browser", "calendar", "docker", "github", "lima", "memory", "kubectl", "n8n", "pg", "rdctl", "redis", "slack"], optional: true, description: "Specific category of tools" },
    query: { type: 'string' as const, optional: true, description: "Keyword to filter tool names/descriptions" },
  },
  workerClass: BrowseToolsWorker,
};
