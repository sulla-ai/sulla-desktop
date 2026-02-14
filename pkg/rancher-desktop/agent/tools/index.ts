// src/tools/index.ts
import { toolRegistry } from "./registry";

// Import all your tools here (this is the only place you need to add new ones)
import { AddObservationalMemoryTool } from "./meta/add-observational-memory.tool";
import { BrowseToolsTool } from "./meta/browse-tools.tool";
import { CreatePlanTool } from "./meta/create-plan.tool";
import { InstallSkillTool } from "./meta/install-skill.tool";
import { RemoveObservationalMemoryTool } from "./meta/remove-observational-memory.tool";
import { SetActionTool } from "./meta/set-action.tool";

// Memory category tools
import { ArticleCreateTool } from "./memory/article-create.tool";
import { ArticleFindTool } from "./memory/article-find.tool";
import { ArticleUpdateTool } from "./memory/article-update.tool";
import { ArticleDeleteTool } from "./memory/article-delete.tool";
import { ArticleListTool } from "./memory/article-list.tool";
import { ArticleSearchTool } from "./memory/article-search.tool";
import { ArticleFindRelatedTool } from "./memory/article-find-related.tool";

// Browser category tools
import { BraveSearchTool } from "./browser/brave-search.tool";
import { DuckDuckGoSearchTool } from "./browser/duckduckgo-search.tool";

// Calendar category tools
import { CalendarCreateTool } from "./calendar/calendar-create.tool";
import { CalendarListTool } from "./calendar/calendar-list.tool";
import { CalendarGetTool } from "./calendar/calendar-get.tool";
import { CalendarUpdateTool } from "./calendar/calendar-update.tool";
import { CalendarDeleteTool } from "./calendar/calendar-delete.tool";
import { CalendarCancelTool } from "./calendar/calendar-cancel.tool";
import { CalendarListUpcomingTool } from "./calendar/calendar-list-upcoming.tool";

// GitHub category tools
import { GitHubGetIssuesTool } from "./github/github-get-issues.tool";
import { GitHubGetIssueTool } from "./github/github-get-issue.tool";
import { GitHubCommentOnIssueTool } from "./github/github-comment-on-issue.tool";
import { GitHubCreateFileTool } from "./github/github-create-file.tool";
import { GitHubReadFileTool } from "./github/github-read-file.tool";
import { GitHubListBranchesTool } from "./github/github-list-branches.tool";

// GitLab category tools
import { GitLabGetIssuesTool } from "./gitlab/gitlab-get-issues.tool";
import { GitLabGetIssueTool } from "./gitlab/gitlab-get-issue.tool";
import { GitLabCommentOnIssueTool } from "./gitlab/gitlab-comment-on-issue.tool";
import { GitLabCreateFileTool } from "./gitlab/gitlab-create-file.tool";
import { GitLabReadFileTool } from "./gitlab/gitlab-read-file.tool";

// Gmail category tools
import { GmailCreateDraftTool } from "./gmail/gmail-create-draft.tool";
import { GmailSendMessageTool } from "./gmail/gmail-send-message.tool";
import { GmailSearchTool } from "./gmail/gmail-search.tool";
import { GmailGetMessageTool } from "./gmail/gmail-get-message.tool";
import { GmailGetThreadTool } from "./gmail/gmail-get-thread.tool";

import { getIntegrationService } from '../services/IntegrationService';

const getIntegrationId = (toolName: string): string | null => {
  if (toolName.startsWith('github_')) return 'github';
  if (toolName.startsWith('gitlab_')) return 'gitlab';
  if (toolName.startsWith('gmail_')) return 'gmail';
  if (toolName.startsWith('calendar_')) return 'google_calendar';
  if (toolName.startsWith('brave_')) return 'brave_search';
  return null;
};

const registerFilteredTools = async () => {
  const integrationService = getIntegrationService();

  const toolClasses = [
    // Meta
    AddObservationalMemoryTool,
    BrowseToolsTool,
    CreatePlanTool,
    InstallSkillTool,
    RemoveObservationalMemoryTool,
    SetActionTool,
    // Memory
    ArticleCreateTool,
    ArticleFindTool,
    ArticleUpdateTool,
    ArticleDeleteTool,
    ArticleListTool,
    ArticleSearchTool,
    ArticleFindRelatedTool,
    // Browser
    BraveSearchTool,
    DuckDuckGoSearchTool,
    // Calendar
    CalendarCreateTool,
    CalendarListTool,
    CalendarGetTool,
    CalendarUpdateTool,
    CalendarDeleteTool,
    CalendarCancelTool,
    CalendarListUpcomingTool,
    // GitHub
    GitHubGetIssuesTool,
    GitHubGetIssueTool,
    GitHubCommentOnIssueTool,
    GitHubCreateFileTool,
    GitHubReadFileTool,
    GitHubListBranchesTool,
    // GitLab
    GitLabGetIssuesTool,
    GitLabGetIssueTool,
    GitLabCommentOnIssueTool,
    GitLabCreateFileTool,
    GitLabReadFileTool,
    // Gmail
    GmailCreateDraftTool,
    GmailSendMessageTool,
    GmailSearchTool,
    GmailGetMessageTool,
    GmailGetThreadTool,
  ];

  const filteredTools = [];

  for (const ToolClass of toolClasses) {
    const toolInstance = new ToolClass();
    const integrationId = getIntegrationId(toolInstance.name);
    let shouldRegister = true;

    if (integrationId) {
      try {
        const isConnected = await integrationService.getConnectionStatus(integrationId);
        // Assuming IntegrationConnectionStatus has a 'connected' boolean property
        shouldRegister = (isConnected as any).connected || Boolean(isConnected);
      } catch (error) {
        console.error(`Error checking connection for ${integrationId}:`, error);
        shouldRegister = false;
      }
    }

    if (shouldRegister) {
      filteredTools.push(toolInstance);
    }
  }

  toolRegistry.registerMany(filteredTools);
};

registerFilteredTools();

// Export everything you need in the rest of your app
export const tools = toolRegistry.getLLMTools();
export const { getToolsByCategory, getCategories } = toolRegistry;
export { toolRegistry };

// Convenience for LangGraph agents
export const createAgentTools = () => toolRegistry.getAllTools();