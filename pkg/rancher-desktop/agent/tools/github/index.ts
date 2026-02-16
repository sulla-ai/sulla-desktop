// Import all github tool registrations
import { gitHubCommentOnIssueRegistration } from './github_comment_on_issue';
import { gitHubCreateFileRegistration } from './github_create_file';
import { gitHubGetIssueRegistration } from './github_get_issue';
import { gitHubGetIssuesRegistration } from './github_get_issues';
import { gitHubListBranchesRegistration } from './github_list_branches';
import { gitHubReadFileRegistration } from './github_read_file';

// Export all github tool registrations as an array
export const githubToolRegistrations = [
  gitHubCommentOnIssueRegistration,
  gitHubCreateFileRegistration,
  gitHubGetIssueRegistration,
  gitHubGetIssuesRegistration,
  gitHubListBranchesRegistration,
  gitHubReadFileRegistration,
];
