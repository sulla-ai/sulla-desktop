import type { Integration } from './types';

/**
 * Curated popular integrations shown by default on the integrations page.
 * This is a hand-picked subset across categories — the "landing page" view.
 * Clicking a category in the sidebar lazy-loads the full native catalogs.
 */
export const popularIntegrations: Record<string, Integration> = {
  slack: {
    id: 'slack', sort: 1, paid: false, beta: false, comingSoon: false, connected: false,
    name: 'Slack', description: 'Send notifications, share updates, and interact with team members through channels and direct messages.',
    category: 'Communication', icon: 'slack.svg', version: '1.0.0', lastUpdated: '2026-02-06 21:00:00', developer: 'Sulla',
  },
  github: {
    id: 'github', sort: 2, paid: false, beta: false, comingSoon: false, connected: false,
    name: 'GitHub', description: 'Manage repositories, issues, pull requests, and automate your development workflow.',
    category: 'Developer Tools', icon: 'github.svg', version: '1.0.0', lastUpdated: '2026-02-14 00:00:00', developer: 'Sulla',
  },
  grok: {
    id: 'grok', sort: 3, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'Grok', description: 'Connect xAI Grok models for agent prompts and completions.',
    category: 'AI Infrastructure', icon: '🚀', version: '1.0.0', lastUpdated: '2026-02-28 11:42:00', developer: 'xAI',
  },
  anthropic: {
    id: 'anthropic', sort: 5, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'Anthropic', description: 'Connect Anthropic Claude models for reasoning and assistant tasks.',
    category: 'AI Infrastructure', icon: '🧠', version: '1.0.0', lastUpdated: '2026-02-28 11:42:00', developer: 'Anthropic',
  },
  openai: {
    id: 'openai', sort: 6, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'OpenAI', description: 'Connect OpenAI models for chat, reasoning, and multimodal generation.',
    category: 'AI Infrastructure', icon: '🤖', version: '1.0.0', lastUpdated: '2026-02-28 11:42:00', developer: 'OpenAI',
  },
  kimi: {
    id: 'kimi', sort: 7, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'Kimi', description: 'Connect Kimi models (Moonshot AI) for long-context generation tasks.',
    category: 'AI Infrastructure', icon: '🌙', version: '1.0.0', lastUpdated: '2026-02-28 11:42:00', developer: 'Moonshot AI',
  },
  nvidia: {
    id: 'nvidia', sort: 8, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'NVIDIA', description: 'Connect NVIDIA NIM and hosted inference endpoints for AI workloads.',
    category: 'AI Infrastructure', icon: '🟢', version: '1.0.0', lastUpdated: '2026-02-28 11:42:00', developer: 'NVIDIA',
  },
  ollama: {
    id: 'ollama', sort: 9, paid: false, beta: false, comingSoon: false, connected: false,
    name: 'Ollama', description: 'Connect to a local or remote Ollama server for chat and embedding models.',
    category: 'AI Infrastructure', icon: '🦙', version: '1.0.0', lastUpdated: '2026-02-28 12:45:00', developer: 'Ollama',
  },
  custom: {
    id: 'custom', sort: 10, paid: false, beta: false, comingSoon: false, connected: false,
    name: 'Custom', description: 'Connect a custom AI provider endpoint using your own base URL.',
    category: 'AI Infrastructure', icon: '🛠️', version: '1.0.0', lastUpdated: '2026-02-28 11:46:00', developer: 'Custom',
  },
  notion: {
    id: 'notion', sort: 11, paid: false, beta: false, comingSoon: false, connected: false,
    name: 'Notion', description: 'Create and manage pages, databases, and wikis.',
    category: 'Productivity', icon: '📝', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'Notion',
  },
  jira: {
    id: 'jira', sort: 12, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'Jira', description: 'Create and manage issues, sprints, and boards.',
    category: 'Project Management', icon: '🔵', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'Atlassian',
  },
  hubspot: {
    id: 'hubspot', sort: 13, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'HubSpot', description: 'Manage contacts, deals, and pipelines.',
    category: 'CRM & Sales', icon: '🟠', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'HubSpot',
  },
  stripe: {
    id: 'stripe', sort: 14, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'Stripe', description: 'Manage payments, subscriptions, and invoices.',
    category: 'Finance', icon: '💳', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'Stripe',
  },
  shopify: {
    id: 'shopify', sort: 15, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'Shopify', description: 'Manage products, orders, customers, and inventory.',
    category: 'E-Commerce', icon: '🛒', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'Shopify',
  },
  zendesk: {
    id: 'zendesk', sort: 16, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'Zendesk', description: 'Manage tickets, users, and helpdesk workflows.',
    category: 'Customer Support', icon: '🎫', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'Zendesk',
  },
  figma: {
    id: 'figma', sort: 17, paid: true, beta: false, comingSoon: false, connected: false,
    name: 'Figma', description: 'Access design files, components, and tokens.',
    category: 'Design', icon: '🎨', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'Figma',
  },
  google_drive: {
    id: 'google_drive', sort: 18, paid: false, beta: false, comingSoon: false, connected: false,
    name: 'Google Drive', description: 'Upload, download, and manage files and folders.',
    category: 'File Storage', icon: '📁', version: '1.0.0', lastUpdated: '2026-02-28', developer: 'Google',
  },
};
