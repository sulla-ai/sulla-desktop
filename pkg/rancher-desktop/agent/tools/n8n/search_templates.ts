import { BaseTool, ToolRegistration, ToolResponse } from "../base";
import { createN8nService } from "../../services/N8nService";

/**
 * Search Templates Tool - Worker class for execution
 */
export class SearchTemplatesWorker extends BaseTool {
  name: string = '';
  description: string = '';
  schemaDef: any = {};
  
  protected async _validatedCall(input: any): Promise<ToolResponse> {
    try {
      const service = await createN8nService();
      const result = await service.searchTemplates({
        search: input.search,
        category: input.category,
        nodes: input.nodes,
        page: input.page,
        limit: input.limit,
      });

      // Format a proper message for the LLM
      const templates = result.templates || [];
      const totalCount = result.totalCount || templates.length;
      
      let message = `Found ${totalCount} n8n workflow templates`;
      if (input.search) message += ` matching "${input.search}"`;
      if (input.category) message += ` in category "${input.category}"`;
      message += `:\n\n`;

      if (templates.length === 0) {
        message += "No templates found matching your criteria.";
      } else {
        message += templates.slice(0, 10).map((template: any, index: number) => 
          `${index + 1}. **${template.name}**\n   ${template.description || 'No description available'}\n   Category: ${template.categories?.[0]?.name || 'Uncategorized'}\n   ID: ${template.id}`
        ).join('\n\n');
        
        if (templates.length > 10) {
          message += `\n\n... and ${templates.length - 10} more templates`;
        }
      }

      return {
        successBoolean: true,
        responseString: message
      };
    } catch (error) {
      return {
        successBoolean: false,
        responseString: `Error searching n8n templates: ${(error as Error).message}`
      };
    }
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
