import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { toolRegistry } from "../registry";

/**
 * Browse Tools Tool - Worker class for execution
 */
export class BrowseToolsWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};

  private getToolSignature(tool: any): any {
    try {
      return tool?.jsonSchema ?? tool?.schemaDef ?? null;
    } catch {
      return tool?.schemaDef ?? null;
    }
  }

  protected async _validatedCall(input: any): Promise<ToolResponse> {
    const { category, query } = input;
    const availableCategories = toolRegistry.getCategories();

    if (category && !availableCategories.includes(category)) {
      return {
        successBoolean: false,
        responseString: `Invalid value for category: must be one of ${availableCategories.join(', ')}`,
      };
    }

    const tools = await toolRegistry.searchTools(query, category);
    const accessPolicy = (this.state?.metadata as any)?.__toolAccessPolicy || {};
    const allowedOperations = Array.isArray(accessPolicy.allowedOperations) ? new Set(accessPolicy.allowedOperations) : null;
    const allowedCategories = Array.isArray(accessPolicy.allowedCategories) ? new Set(accessPolicy.allowedCategories) : null;
    const allowedToolNames = Array.isArray(accessPolicy.allowedToolNames) ? new Set(accessPolicy.allowedToolNames) : null;

    const filteredTools = tools.filter((tool: any) => {
      const operationTypes = Array.isArray(tool.metadata?.operationTypes)
        ? tool.metadata.operationTypes
        : toolRegistry.getToolOperations(tool.name);

      if (allowedOperations && !operationTypes.some((operation: string) => allowedOperations.has(operation))) {
        return false;
      }

      if (allowedCategories && !allowedCategories.has(tool.metadata?.category || tool.category)) {
        return false;
      }

      if (allowedToolNames && !allowedToolNames.has(tool.name)) {
        return false;
      }

      return true;
    });

    if (filteredTools.length === 0) {
      return {
        successBoolean: false,
        responseString: `No tools found${category ? ` in category "${category}"` : ""}${query ? ` matching "${query}"` : ""}.\n\nAvailable categories: ${toolRegistry.getCategories().join(", ")}`
      }
    }

    // Attach found tools to state for LLM access
    if (this.state) {
      // Accumulate found tools (append to existing)
      const existingFoundTools = (this.state as any).foundTools || [];
      (this.state as any).foundTools = [...existingFoundTools, ...filteredTools];

      // Accumulate LLM tools: ensure meta tools are included + append new found tools (avoid duplicates)
      const existingLLMTools = (this.state as any).llmTools || [];
      const metaTools = await toolRegistry.getLLMToolsForCategory("meta")();
      const newLLMTools = await Promise.all(filteredTools.map(tool => toolRegistry.convertToolToLLM(tool.name)));
      
      // Combine all tools, avoiding duplicates by function name
      const allTools = [...metaTools, ...existingLLMTools, ...newLLMTools];
      const uniqueTools = allTools.filter((tool, index, arr) => 
        arr.findIndex(t => t.function?.name === tool.function?.name) === index
      );
      
      (this.state as any).llmTools = uniqueTools;
    }

    const toolDetails = filteredTools.map((tool: any) => ({
      name: tool.name,
      description: tool.description,
      category: tool.metadata?.category || tool.category,
      operationTypes: Array.isArray(tool.metadata?.operationTypes)
        ? tool.metadata.operationTypes
        : toolRegistry.getToolOperations(tool.name),
      signature: this.getToolSignature(tool),
    }));

    return {
      successBoolean: true,
      responseString: `Found ${filteredTools.length} tools${category ? ` in category "${category}"` : ""}${query ? ` matching "${query}"` : ""}.
${JSON.stringify(toolDetails, null, 2)}`
    };
  }
}

// Export the complete tool registration with type enforcement
export const browseToolsRegistration: ToolRegistration = {
  name: "browse_tools",
  description: "List available tools by category or search term. Use this when you need a tool but don't know its exact name or category yet.",
  category: "meta",
  operationTypes: ['read','create','update','delete'],
  schemaDef: {
    category: { type: 'string' as const, optional: true, description: "Specific category of tools (e.g. meta, fs, workspace, slack, n8n)" },
    query: { type: 'string' as const, optional: true, description: "Keyword to filter tool names/descriptions" },
  },
  workerClass: BrowseToolsWorker,
};
