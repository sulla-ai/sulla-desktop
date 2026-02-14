// src/tools/registry.ts
import { BaseTool } from "./base";
import { zodToJsonSchema } from "zod-to-json-schema";

export class ToolRegistry {
  private tools: BaseTool[] = [];
  private categories = new Map<string, BaseTool[]>();

  register(tool: BaseTool) {
    this.tools.push(tool);
    const cat = tool.metadata.category;
    if (!this.categories.has(cat)) this.categories.set(cat, []);
    this.categories.get(cat)!.push(tool);
  }

  registerMany(tools: BaseTool[]) {
    tools.forEach(t => this.register(t));
  }

  // THIS IS THE ONE YOU MUST USE FOR THE LLM
  private convertToLLM(tool: BaseTool): any {
    let jsonSchema = zodToJsonSchema(tool.schema, {
      target: "jsonSchema7",
      $refStrategy: "none",
      pipeStrategy: "all",
    }) as any;

    // Cleanup
    delete jsonSchema.$schema;
    delete jsonSchema.additionalProperties;
    delete jsonSchema.definitions;
    delete jsonSchema.$defs;

    if (jsonSchema.properties) {
      Object.values(jsonSchema.properties).forEach((p: any) => {
        delete p.format;
        if (p.default === null) delete p.default;
      });
    }

    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: jsonSchema,
      },
    };
  }

  getLLMTools(): any[] {
    return this.tools.map((tool) => this.convertToLLM(tool));
  }

  getLLMToolsFor(tools: BaseTool[]): any[] {
    return tools.map((tool) => this.convertToLLM(tool));
  }

  // Legacy (don't use this anymore for the LLM)
  getAllTools() {
    return this.tools;
  }

  getToolsByCategory(category: string) {
    return this.categories.get(category) || [];
  }

  getCategories() {
    return Array.from(this.categories.keys());
  }

  searchTools(query?: string, category?: string): BaseTool[] {
    let tools: BaseTool[] = [];
    if (category) {
      tools = this.getToolsByCategory(category);
    } else {
      tools = this.getAllTools();
    }
    if (query) {
      const q = query.toLowerCase();
      tools = tools.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    }
    return tools;
  }

  addTool(tool: BaseTool) {
    this.register(tool);
  }
}

export const toolRegistry = new ToolRegistry();