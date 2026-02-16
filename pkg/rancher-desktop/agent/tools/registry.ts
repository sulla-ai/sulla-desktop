// src/tools/registry.ts

type ToolLoader = () => Promise<any>;

export interface ToolEntry {
  name: string;
  description: string;
  category: string;
  loader: ToolLoader;
}

export interface ToolRegistration {
  name: string;
  description: string;
  category: string;
  schemaDef: any;
  workerClass: new () => any;
}

export class ToolRegistry {
  private static registrations = new Map<string, ToolRegistration>();
  private loaders = new Map<string, ToolLoader>();
  private instances = new Map<string, any>();
  private llmSchemaCache = new Map<string, any>();           // NEW: cache converted schemas
  private categories = new Map<string, string[]>();
  private descriptions = new Map<string, string>();
  private categoriesList = [
    'meta', 'memory', 'browser', 'calendar', 'docker', 'fs', 'github',
    'integrations', 'kubectl', 'n8n', 'slack', 'workspace', 'redis', 'pg', 'rdctl', 'lima'
  ];

  private categoryDescriptions: Record<string, string> = {
    meta: "Tools for browsing available tools, installing skills, and meta management.",
    memory: "Tools for finding and managing memory articles.",
    browser: "Web search tools like Brave and DuckDuckGo.",
    calendar: "Tools for managing calendar events.",
    docker: "Tools for Docker container management.",
    fs: "File system operations tools.",
    github: "GitHub repository management tools.",
    kubectl: "Kubernetes cluster management tools.",
    n8n: "Tools for managing n8n workflows, executions, credentials, tags, variables, and data tables.",
    slack: "Slack messaging and reaction tools.",
    workspace: "Tools for managing isolated workspaces in the Lima VM.",
    redis: "Redis key/value store operations.",
    pg: "PostgreSQL database queries and transactions.",
    rdctl: "Sulla Desktop / rdctl management commands.",
    integrations: "Tools for checking integration status and retrieving integration credentials.",
    lima: "Lima VM instance management."
  };

  static register(registration: ToolRegistration) {
    this.registrations.set(registration.name, registration);
  }

  static getRegistrations(): Map<string, ToolRegistration> {
    return this.registrations;
  }

  register(name: string, description: string, category: string, loader: ToolLoader) {
    if (this.loaders.has(name)) return;
    this.loaders.set(name, loader);
    this.descriptions.set(name, description);
    if (!this.categories.has(category)) this.categories.set(category, []);
    this.categories.get(category)!.push(name);
  }

  registerAll(entries: ToolEntry[]) {
    entries.forEach(e => this.register(e.name, e.description, e.category, e.loader));
  }

  registerAllRegistrations(registrations: ToolRegistration[]) {
    const entries = registrations.map((reg, index) => {
      const entry = {
        name: reg.name,
        description: reg.description,
        category: reg.category,
        loader: async () => {
          const instance = new reg.workerClass();
          instance.schemaDef = reg.schemaDef;
          instance.name = reg.name;
          instance.description = reg.description;
          instance.metadata.category = reg.category;
          return instance;
        },
      };
      return entry;
    });
    console.log(`Registering ${entries.length} entries`);
    this.registerAll(entries);
  }

  async getTool(name: string): Promise<any> {
    if (this.instances.has(name)) return this.instances.get(name)!;
    const loader = this.loaders.get(name);
    if (!loader) throw new Error(`Tool ${name} not registered`);
    const tool = await loader();
    this.instances.set(name, tool);
    return tool;
  }

  async getToolsByCategory(category: string): Promise<any[]> {
    const names = this.categories.get(category) || [];
    return Promise.all(names.map(name => this.getTool(name)));
  }

  async convertToolToLLM(toolOrName: string | any): Promise<any> {
    let tool: any;
    if (typeof toolOrName === 'string') {
      tool = await this.getTool(toolOrName);
    } else {
      tool = toolOrName;
    }

    if (this.llmSchemaCache.has(tool.name)) {
      return this.llmSchemaCache.get(tool.name);
    }

    // Use the tool's own jsonSchema getter (from BaseTool)
    const parameters = tool.jsonSchema;

    const formatted = {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters,
      },
    };

    this.llmSchemaCache.set(tool.name, formatted);
    return formatted;
  }

  getLLMToolsForCategory(category: string): () => Promise<any[]> {
    return async () => {
      const names = this.categories.get(category) || [];
      return Promise.all(names.map(name => this.convertToolToLLM(name)));
    };
  }

  getAllLLMTools(): () => Promise<any[]> {
    return async () => {
      if (this.loaders.size > 40) {
        console.warn(`Loading ${this.loaders.size} tools — prefer category filtering`);
      }
      const allNames = Array.from(this.loaders.keys());
      return Promise.all(allNames.map(name => this.convertToolToLLM(name)));
    };
  }

  // For browse_tools — cheap metadata only, no loading instances or schemas
  getCategoryToolMetadata(category: string): () => Promise<Array<{ name: string; description: string; category: string }>> {
    return async () => {
      const names = this.categories.get(category) || [];
      return names.map(name => ({
        name,
        description: this.descriptions.get(name) || '',
        category,
      }));
    };
  }

  async getLLMToolsFor(tools: any[]): Promise<any[]> {
    return Promise.all(tools.map(tool => this.convertToolToLLM(tool)));
  }

  async searchTools(query?: string, category?: string): Promise<any[]> {
    let names: string[] = this.categories.get(category || '') || [];
    if (query) {
      const q = query.toLowerCase();
      names = names.filter(name => {
        if (name.toLowerCase().includes(q)) return true;
        const desc = this.descriptions.get(name);
        return desc && desc.toLowerCase().includes(q);
      });
    }
    return Promise.all(names.map(name => this.getTool(name)));
  }

  getCategories(): string[] {
    return this.categoriesList;
  }

  getCategoriesWithDescriptions(): { category: string; description: string }[] {
    return this.categoriesList.map(cat => ({
      category: cat,
      description: this.categoryDescriptions[cat] || 'No description available.',
    }));
  }

  clearCache() {
    this.instances.clear();
    this.llmSchemaCache.clear();
  }
}

export const toolRegistry = new ToolRegistry();