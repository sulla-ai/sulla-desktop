// src/tools/registry.ts
import { BaseTool } from "./base";
import { zodToJsonSchema } from "zod-to-json-schema";

type ToolLoader = () => Promise<BaseTool>;

export class ToolRegistry {
  private loaders = new Map<string, ToolLoader>();         // name → async factory
  private instances = new Map<string, BaseTool>();         // cache instantiated tools
  private categories = new Map<string, string[]>();        // category → [tool names]
  private loadedCategories = new Set<string>();
  private categoriesList = ['meta', 'memory', 'browser', 'calendar', 'docker', 'fs', 'github', 'kubectl', 'slack'];

  private async loadCategory(category: string) {
    if (this.loadedCategories.has(category) || !this.categoriesList.includes(category)) return;
    try {
      await import(`./${category}/index.ts`);
      this.loadedCategories.add(category);
    } catch (e) {
      console.warn(`Failed to load category ${category}:`, e);
    }
  }

  /**
   * Register a lazy-loaded tool
   */
  registerLazy(name: string, loader: ToolLoader, category: string) {
    if (this.loaders.has(name)) {
      console.warn(`Tool ${name} already registered`);
      return;
    }

    this.loaders.set(name, loader);

    if (!this.categories.has(category)) {
      this.categories.set(category, []);
    }
    this.categories.get(category)!.push(name);
  }

  /**
   * Add an already instantiated tool
   */
  addTool(tool: BaseTool) {
    const name = tool.name;
    const category = tool.metadata.category || 'misc';

    if (this.instances.has(name)) {
      console.warn(`Tool ${name} already added`);
      return;
    }

    this.instances.set(name, tool);

    if (!this.categories.has(category)) {
      this.categories.set(category, []);
    }
    this.categories.get(category)!.push(name);
  }

  /**
   * Get or instantiate a tool (lazy)
   */
  async getTool(name: string): Promise<BaseTool> {
    if (this.instances.has(name)) {
      return this.instances.get(name)!;
    }

    const loader = this.loaders.get(name);
    if (!loader) {
      throw new Error(`Tool ${name} not registered`);
    }

    const tool = await loader();
    this.instances.set(name, tool);
    return tool;
  }

  /**
   * Get all tools in a category (loads them lazily)
   */
  async getToolsByCategory(category: string): Promise<BaseTool[]> {
    await this.loadCategory(category);
    const names = this.categories.get(category) || [];
    return Promise.all(names.map(name => this.getTool(name)));
  }

  /**
   * Get LLM-compatible schema for a single tool
   */
  private convertToolToLLM(tool: BaseTool): any {
    let jsonSchema = zodToJsonSchema(tool.schema, {
      target: "jsonSchema7",
      $refStrategy: "none",
      pipeStrategy: "all",
    }) as any;

    // Cleanup (same as before)
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

  private async convertToLLM(name: string): Promise<any> {
    const tool = await this.getTool(name);
    return this.convertToolToLLM(tool);
  }

  /**
   * Get LLM tools for a category (recommended for agents)
   * Loads only the tools in that category
   */
  getLLMToolsForCategory(category: string): () => Promise<any[]> {
    return async () => {
      await this.loadCategory(category);
      const names = this.categories.get(category) || [];
      return Promise.all(names.map(name => this.convertToLLM(name)));
    };
  }

  /**
   * Get ALL LLM tools (loads everything – use sparingly)
   */
  getAllLLMTools(): () => Promise<any[]> {
    return async () => {
      const allNames = Array.from(this.loaders.keys());
      return Promise.all(allNames.map(name => this.convertToLLM(name)));
    };
  }

  /**
   * Get LLM tools for a list of tools
   */
  getLLMToolsFor(tools: BaseTool[]): Promise<any[]> {
    return Promise.all(tools.map(tool => this.convertToolToLLM(tool)));
  }

  /**
   * Search tools by name/description (loads category if specified)
   */
  async searchTools(query?: string, category?: string): Promise<BaseTool[]> {
    if (category) {
      await this.loadCategory(category);
    } else {
      // Avoid loading all categories to prevent heap issues
      return [];
    }

    let names: string[] = [];

    if (category) {
      names = this.categories.get(category) || [];
    } else {
      names = Array.from(this.loaders.keys());
    }

    if (query) {
      const q = query.toLowerCase();
      names = names.filter(name =>
        name.toLowerCase().includes(q)
      );
    }

    return Promise.all(names.map(name => this.getTool(name)));
  }

  getCategories(): string[] {
    return this.categoriesList;
  }

  // Optional: clear cache if memory pressure is detected
  clearCache() {
    this.instances.clear();
  }
}

export const toolRegistry = new ToolRegistry();