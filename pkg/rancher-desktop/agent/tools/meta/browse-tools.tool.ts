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

    let tools: StructuredTool[] = [];

    if (category) {
      tools = toolRegistry.getToolsByCategory(category);
    } else {
      tools = toolRegistry.getAllTools();
    }

    if (query) {
      const q = query.toLowerCase();
      tools = tools.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    }

    if (tools.length === 0) {
      return `No tools found${
        category ? ` in category "${category}"` : ""
      }${query ? ` matching "${query}"` : ""}.\n\nAvailable categories: ${toolRegistry.getCategories().join(", ")}`;
    }

    let output = `**Tools${category ? ` in "${category}"` : ""}${query ? ` matching "${query}"` : ""}:**\n\n`;

    for (const tool of tools) {
      output += `- **${tool.name}**  \n  ${tool.description}\n`;
    }

    return output;
  }
}