import { BaseTool } from "../base";
import { z } from "zod";
import { toolRegistry } from "../registry";
import { StructuredTool } from "@langchain/core/tools";

export class BrowseToolsTool extends BaseTool {
  name = "browse_tools";
  description = "List available tools by category or search term. Use this when you need a tool but don't know its exact name or category yet.";
  schema = z.object({
    category: z.string().optional().describe("Specific category e.g. browser, database, search"),
    query: z.string().optional().describe("Keyword to filter tool names/descriptions"),
  });

  metadata = { category: "meta" };

      protected async _call(input: z.infer<this["schema"]>) {
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
      // Set LLM tools: meta + found
      const metaTools = await toolRegistry.getToolsByCategory("meta");
      const metaLLMTools = await toolRegistry.getLLMToolsFor(metaTools);
      const foundLLMTools = await toolRegistry.getLLMToolsFor(tools);
      (this.state as any).llmTools = [...metaLLMTools, ...foundLLMTools];
    }

    let output = `**Tools${category ? ` in "${category}"` : ""}${query ? ` matching "${query}"` : ""}:**\n\n`;

    for (const tool of tools) {
      output += `- **${tool.name}**  \n  ${tool.description}\n`;
    }

    return output;
  }
}

toolRegistry.registerLazy('browse_tools', async () => new BrowseToolsTool(), 'meta');