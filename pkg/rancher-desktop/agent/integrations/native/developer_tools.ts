import type { Integration } from '../types';

export const nativeGitHubIntegration: Record<string, Integration> = {
  github: {
    id: 'github',
    sort: 1,
    beta: true,
    comingSoon: false,
    name: 'GitHub',
    description: 'Version control and collaboration platform for software development. Manage repositories, issues, pull requests, and automate your development workflow with powerful integrations.',
    category: 'Developer Tools',
    icon: 'github.svg',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2026-02-14 00:00:00',
    developer: 'Jonathon Byrdziak & Alan Carvalho',
    formGuide: 'Create a personal access token at github.com/settings/tokens. Select the scopes needed for your automation tasks.',
    installationGuide: {
      title: 'GitHub Personal Access Token Setup Guide',
      description: 'Create a GitHub token for API access (2-3 minutes)',
      steps: [
        {
          title: 'Go to GitHub Settings',
          content: `1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give your token a descriptive name
4. Select the appropriate scopes for your needs`
        },
        {
          title: 'Configure Token Scopes',
          content: `Select these scopes based on your needs:
• repo - Full control of private repositories
• public_repo - Access public repositories
• read:org - Read org and team membership
• write:repo_hook - Manage repository hooks
• read:user - Read user profile data`
        },
        {
          title: 'Generate and Save Token',
          content: `1. Click "Generate token"
2. Copy the token immediately (you won't see it again)
3. Store it securely in your Sulla configuration
4. Test the token with a simple API call`
        }
      ],
      importantNotes: [
        'Keep your token secure - anyone with the token has access to your repositories',
        'Use the minimum required scopes for security',
        'Tokens can be regenerated if compromised',
        'GitHub tokens expire after 1 year by default'
      ]
    },
    features: [
      {
        title: 'Repository Management',
        description: 'Create, manage, and automate repository operations'
      },
      {
        title: 'Issue Tracking',
        description: 'Manage issues, labels, and project boards'
      },
      {
        title: 'Pull Request Workflow',
        description: 'Handle code reviews and merge requests'
      },
      {
        title: 'Webhook Integration',
        description: 'Receive real-time notifications for repository events'
      }
    ],
    guideLinks: [
      {
        title: 'GitHub Developer Documentation',
        description: 'Complete API reference and guides',
        url: 'https://docs.github.com/en/rest'
      },
      {
        title: 'Personal Access Tokens',
        description: 'Learn about GitHub authentication',
        url: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token'
      }
    ],
    properties: [
      {
        key: 'token',
        title: 'GitHub Token',
        hint: 'Your GitHub personal access token',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^ghp_[a-zA-Z0-9]{36}$',
          minLength: 40,
          maxLength: 40
        }
      }
    ],
  },
};
