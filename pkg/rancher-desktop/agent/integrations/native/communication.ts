import type { Integration } from '../types';

export const nativeSlackIntegration: Record<string, Integration> = {
  slack: {
    id: 'slack',
    sort: 1,
    beta: true,
    comingSoon:false,
    name: 'Slack',
    description: 'Team collaboration platform that brings all your communication together. Enable SULLA to send notifications, share updates, and interact with team members through channels and direct messages.',
    category: 'Communication',
    icon: 'slack.svg',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2026-02-06 21:00:00',
    developer: 'Jonathon Byrdziak & Alan Carvalho',
    formGuide: 'Follow the installation guide below to create and configure your Slack app.',
    installationGuide: {
      title: 'Slack Bot Setup Guide',
      description: 'Create a custom Slack app for your personal workspace (5-7 minutes)',
      steps: [
        {
          title: 'Create Slack App',
          content: `1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name your app and select your workspace
4. Click "Create App"`
        },
        {
          title: 'Enable Socket Mode',
          content: `1. In the left menu, go to "Socket Mode"
2. Toggle "Enable Socket Mode" to ON
3. Click "Generate" to create a new App-Level Token
4. No special scopes needed for this token
5. Copy the generated token (starts with xapp-)
6. Save this token as your "Scopes Token" in Sulla`
        },
        {
          title: 'Configure Bot Permissions',
          content: `1. In the left menu, go to "OAuth & Permissions"
2. Scroll to "Bot Token Scopes"
3. Click "Add an OAuth Scope" and add:
   • chat:write
   • files:write
   • channels:read
   • groups:read
   • im:read
   • mpim:read
   • users:read
   • users:read.email
4. Click "Save Changes"`
        },
        {
          title: 'Install App to Workspace',
          content: `1. Scroll to top of "OAuth & Permissions" page
2. Click "Install to Workspace" (or "Reinstall" if updating)
3. Review permissions and click "Allow"
4. Copy the "Bot User OAuth Token" (starts with xoxb-)
5. Save this token as your "Bot Token" in Sulla`
        },
        {
          title: 'Invite Bot to Channel',
          content: `1. Go to any Slack channel where you want the bot to work
2. Type: /invite @YourBotName
3. Or click the channel name → "Integrations" → "Add apps"
4. Find and add your bot to the channel`
        }
      ],
      importantNotes: [
        'Keep both tokens secure - they provide full access to your workspace',
        'The bot can only see messages in channels where it\'s been invited',
        'Socket Mode is required for local development without public webhooks',
        'You must be a workspace admin to create custom apps'
      ]
    },
    guideLinks: [
      {
        title: 'Slack App Dashboard',
        description: 'Manage your Slack apps and configurations',
        url: 'https://api.slack.com/apps'
      },
      {
        title: 'Bot Token Documentation',
        description: 'Learn about Slack bot tokens and permissions',
        url: 'https://api.slack.com/authentication/basics'
      },
      {
        title: 'Socket Mode Guide',
        description: 'Understanding Socket Mode for local development',
        url: 'https://api.slack.com/apis/connections/socket'
      }
    ],
    media: [
      {
        type: 'youtube',
        url: 'EDATYbzYGiE',
        alt: 'Slack Platform Overview',
        caption: 'Watch how Slack transforms team communication and collaboration'
      },
      {
        type: 'image',
        url: 'slack-media-1.jpeg',
        alt: 'Slack Desktop Client',
        caption: 'Native Slack desktop application'
      },
      {
        type: 'image',
        url: 'slack-media-2.png',
        alt: 'Slack Integrations',
        caption: 'Slack integrations marketplace'
      }
    ],
    features: [
      {
        title: 'Channel Organization',
        description: 'Organize conversations by topic, project, or team with unlimited channels'
      },
      {
        title: 'Direct Messaging',
        description: 'One-on-one and group conversations with team members'
      },
      {
        title: 'File Sharing',
        description: 'Share documents, images, and integrate with cloud storage services'
      },
      {
        title: 'App Integrations',
        description: 'Connect thousands of apps for automated workflows and notifications'
      }
    ],
    properties: [
      {
        key: 'bot_token',
        title: 'Bot User OAuth Token',
        hint: '',
        type: 'password',
        required: true,
        placeholder: ''
      },
      {
        key: 'scopes_token',
        title: 'Scopes Token',
        hint: '',
        type: 'password',
        required: true,
        placeholder: ''
      }
    ],
  },
};
