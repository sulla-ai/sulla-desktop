import type { Integration } from './types';

/**
 * Curated popular integrations shown by default on the integrations page.
 * This is a hand-picked subset across categories — the "landing page" view.
 * Clicking a category in the sidebar lazy-loads the full native + composio catalogs.
 */
export const popularIntegrations: Record<string, Integration> = {
  slack: {
    id: 'slack', sort: 1, beta: true, comingSoon: false, connected: false,
    name: 'Slack', description: 'Send notifications, share updates, and interact with team members through channels and direct messages.',
    category: 'Communication', icon: 'slack.svg', version: '1.0.0', lastUpdated: '2026-02-06 21:00:00', developer: 'Sulla',
  },
  github: {
    id: 'github', sort: 2, beta: true, comingSoon: false, connected: false,
    name: 'GitHub', description: 'Manage repositories, issues, pull requests, and automate your development workflow.',
    category: 'Developer Tools', icon: 'github.svg', version: '1.0.0', lastUpdated: '2026-02-14 00:00:00', developer: 'Sulla',
  },
  composio: {
    id: 'composio', sort: 3, beta: true, comingSoon: false, connected: false,
    name: 'Composio', description: 'Enable Composio-backed integrations and 10,000 more tools will appear for your agent.',
    category: 'AI Infrastructure', icon: '🧩', version: '1.0.0', lastUpdated: '2026-02-27 23:00:00', developer: 'Sulla',
  },
  grok: {
    id: 'grok', sort: 4, beta: false, comingSoon: false, connected: false,
    name: 'Grok', description: 'Connect xAI Grok models for agent prompts and completions.',
    category: 'AI Infrastructure', icon: '🚀', version: '1.0.0', lastUpdated: '2026-02-28 11:42:00', developer: 'xAI',
  },
  anthropic: {
    id: 'anthropic', sort: 5, beta: false, comingSoon: false, connected: false,
    name: 'Anthropic', description: 'Connect Anthropic Claude models for reasoning and assistant tasks.',
    category: 'AI Infrastructure', icon: '🧠', version: '1.0.0', lastUpdated: '2026-02-28 11:42:00', developer: 'Anthropic',
  },
  openai: {
    id: 'openai', sort: 6, beta: false, comingSoon: false, connected: false,
    name: 'OpenAI', description: 'Connect OpenAI models for chat, reasoning, and multimodal generation.',
    category: 'AI Infrastructure', icon: '🤖', version: '1.0.0', lastUpdated: '2026-02-28 11:42:00', developer: 'OpenAI',
  },
  kimi: {
    id: 'kimi', sort: 7, beta: false, comingSoon: false, connected: false,
    name: 'Kimi', description: 'Connect Kimi models (Moonshot AI) for long-context generation tasks.',
    category: 'AI Infrastructure', icon: '🌙', version: '1.0.0', lastUpdated: '2026-02-28 11:42:00', developer: 'Moonshot AI',
  },
  nvidia: {
    id: 'nvidia', sort: 8, beta: false, comingSoon: false, connected: false,
    name: 'NVIDIA', description: 'Connect NVIDIA NIM and hosted inference endpoints for AI workloads.',
    category: 'AI Infrastructure', icon: '🟢', version: '1.0.0', lastUpdated: '2026-02-28 11:42:00', developer: 'NVIDIA',
  },
  ollama: {
    id: 'ollama', sort: 9, beta: false, comingSoon: false, connected: false,
    name: 'Ollama', description: 'Connect to a local or remote Ollama server for chat and embedding models.',
    category: 'AI Infrastructure', icon: '🦙', version: '1.0.0', lastUpdated: '2026-02-28 12:45:00', developer: 'Ollama',
  },
  custom: {
    id: 'custom', sort: 10, beta: false, comingSoon: false, connected: false,
    name: 'Custom', description: 'Connect a custom AI provider endpoint using your own base URL.',
    category: 'AI Infrastructure', icon: '🛠️', version: '1.0.0', lastUpdated: '2026-02-28 11:46:00', developer: 'Custom',
  },
};
