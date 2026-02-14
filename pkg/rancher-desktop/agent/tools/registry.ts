// src/tools/registry.ts
import { BaseTool } from "./base";
import type { StructuredTool } from "@langchain/core/tools";

/**
 * Central registry — this is the single source of truth.
 * We keep both a flat list (for passing to LLM) and categories (for browsing).
 */
export class ToolRegistry {
  private tools: BaseTool[] = [];
  private categories = new Map<string, BaseTool[]>();

  register(tool: BaseTool) {
    this.tools.push(tool);

    const cat = tool.metadata.category;
    if (!this.categories.has(cat)) {
      this.categories.set(cat, []);
    }
    this.categories.get(cat)!.push(tool);
  }

  registerMany(tools: BaseTool[]) {
    tools.forEach((t) => this.register(t));
  }

  getAllTools(): StructuredTool[] {
    return this.tools;
  }

  getToolsByCategory(category: string): StructuredTool[] {
    return this.categories.get(category) || [];
  }

  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  // For dynamic loading later (install_skill)
  addTool(tool: BaseTool) {
    this.register(tool);
  }
}

// Singleton instance
export const toolRegistry = new ToolRegistry();