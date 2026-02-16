import { BaseTool, ToolRegistration } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Search Templates Tool - Worker class for execution
 */
export class SearchTemplatesWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  protected async _validatedCall(input: any) {
    const service = await createN8nService();
    return await service.searchTemplates({
      search: input.search,
      category: input.category,
      nodes: input.nodes,
      page: input.page,
      limit: input.limit,
    });
  }
}

// Export the complete tool registration with type enforcement
export const searchTemplatesRegistration: ToolRegistration = {
  name: "search_templates",
  description: "Search n8n workflow templates from the public n8n template library. Supports keyword search, category filtering, node filtering, and pagination.",
  category: "n8n",
  schemaDef: {
    search: { type: 'string' as const, optional: true, description: "Keyword or phrase to search for" },
    category: { type: 'string' as const, optional: true, description: "Category to filter templates by" },
    nodes: { type: 'string' as const, optional: true, description: "Specific nodes used in the template to filter by" },
    page: { type: 'number' as const, optional: true, description: "Page number for pagination" },
    limit: { type: 'number' as const, optional: true, description: "Number of results per page" },
  },
  workerClass: SearchTemplatesWorker,
};
