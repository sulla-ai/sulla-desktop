// src/tools/index.ts
import { toolRegistry } from "./registry";

// Import all your tools here (this is the only place you need to add new ones)
// Meta category tools
import { AddObservationalMemoryTool } from "./meta/add-observational-memory.tool";
import { BrowseToolsTool } from "./meta/browse-tools.tool";
import { CreatePlanTool } from "./meta/create-plan.tool";
import { InstallSkillTool } from "./meta/install-skill.tool";
import { RemoveObservationalMemoryTool } from "./meta/remove-observational-memory.tool";
import { SetActionTool } from "./meta/set-action.tool";

// Memory category tools
import { ArticleFindTool } from "./memory/article-find.tool";
import { ArticleSearchTool } from "./memory/article-search.tool";
import { ArticleListTool } from "./memory/article-list.tool";
import { ArticleCreateTool } from "./memory/article-create.tool";
import { ArticleUpdateTool } from "./memory/article-update.tool";
import { ArticleDeleteTool } from "./memory/article-delete.tool";
import { ArticleRelatedTool } from "./memory/article-related.tool";

// Database category tools
import { PostgresQueryTool } from "./postgres/postgres-query.tool";
import { PostgresQueryOneTool } from "./postgres/postgres-queryone.tool";
import { PostgresQueryAllTool } from "./postgres/postgres-queryall.tool";
import { PostgresExecuteTool } from "./postgres/postgres-execute.tool";
import { PostgresCountTool } from "./postgres/postgres-count.tool";
import { PostgresTransactionTool } from "./postgres/postgres-transaction.tool";

// Register everything
toolRegistry.registerMany([
  new AddObservationalMemoryTool(),
  new BrowseToolsTool(),
  new CreatePlanTool(),
  new InstallSkillTool(),
  new RemoveObservationalMemoryTool(),
  new SetActionTool(),
  // Memory category tools
  new ArticleFindTool(),
  new ArticleSearchTool(),
  new ArticleListTool(),
  new ArticleCreateTool(),
  new ArticleUpdateTool(),
  new ArticleDeleteTool(),
  new ArticleRelatedTool(),
  // Database
  new PostgresQueryTool,
  new PostgresQueryOneTool,
  new PostgresQueryAllTool,
  new PostgresExecuteTool,
  new PostgresCountTool,
  new PostgresTransactionTool,
  // ... add more
]);

// Export everything you need in the rest of your app
export const tools = toolRegistry.getLLMTools();
export const { getToolsByCategory, getCategories } = toolRegistry;

// Convenience for LangGraph agents
export const createAgentTools = () => toolRegistry.getAllTools();