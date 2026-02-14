// src/tools/index.ts
import { toolRegistry } from './registry';

// Tool imports
import './meta/set-action.tool';
import './meta/browse-tools.tool';
import './meta/install-skill.tool';
import './memory/article-find.tool';
import './browser/brave-search.tool';
import './browser/duckduckgo-search.tool';
import './calendar/calendar-cancel.tool';
import './calendar/calendar-create.tool';
import './calendar/calendar-delete.tool';
import './calendar/calendar-get.tool';
import './calendar/calendar-list-upcoming.tool';
import './calendar/calendar-list.tool';
import './calendar/calendar-update.tool';
import './docker/docker-build.tool';
import './docker/docker-exec.tool';
import './docker/docker-images.tool';
import './docker/docker-logs.tool';
import './docker/docker-ps.tool';
import './docker/docker-pull.tool';
import './docker/docker-rm.tool';
import './docker/docker-run.tool';
import './docker/docker-stop.tool';
import './fs/fs-cat.tool';
import './fs/fs-df.tool';
import './fs/fs-du.tool';
import './fs/fs-find.tool';
import './fs/fs-grep.tool';
import './fs/fs-head.tool';
import './fs/fs-ls.tool';
import './fs/fs-pwd.tool';
import './fs/fs-stat.tool';
import './fs/fs-tail.tool';
import './github/github-comment-on-issue.tool';
import './github/github-create-file.tool';
import './github/github-get-issue.tool';
import './github/github-get-issues.tool';
import './github/github-list-branches.tool';
import './github/github-read-file.tool';
import './kubectl/kubectl-apply.tool';
import './kubectl/kubectl-delete.tool';
import './kubectl/kubectl-describe.tool';
import './slack/slack-thread.tool';
import './slack/slack-unreact.tool';
import './slack/slack-update.tool';
import './slack/slack-user.tool';

// Export convenience helpers (now async!)
export const getTool = (name: string) => toolRegistry.getTool(name);
export const getToolsByCategory = (cat: string) => toolRegistry.getToolsByCategory(cat);

// Primary tools export - meta category only
export const tools = toolRegistry.getLLMToolsForCategory("meta");

// For LangGraph agents – returns a function that loads on demand for all tools
export const createAgentTools = toolRegistry.getAllLLMTools();

// Export the registry itself for direct access
export { toolRegistry };
