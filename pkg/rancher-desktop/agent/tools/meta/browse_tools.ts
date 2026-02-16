import { BaseTool, ToolRegistration } from "../base";
import { toolRegistry } from "../registry";

/**
 * Browse Tools Tool - Worker class for execution
 */
export class BrowseToolsWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const { category, query } = input;

    const tools = await toolRegistry.searchTools(query, category);

    if (tools.length === 0) {
      return `No tools found${
        category ? ` in category "${category}"` : ""
      }${query ? ` matching "${query}"` : ""}.\n\nAvailable categories: ${toolRegistry.getCategories().join(", ")}`;
    }

    // Attach found tools to state for LLM access
    if (this.state) {
      (this.state as any).foundTools = tools;
      // Set LLM tools: meta + found (convert to LLM format)
      (this.state as any).llmTools = [
        ...(await toolRegistry.getLLMToolsForCategory("meta")()),
        ...await Promise.all(tools.map(tool => toolRegistry.convertToolToLLM(tool.name))),
      ];
    }

    return {
      count: tools.length,
      category: category || "all",
      query: query || null,
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        category: tool.metadata.category,
      })),
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
