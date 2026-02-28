import type { Integration } from '../types';

export const nativeAiInfrastructureIntegrations: Record<string, Integration> = {
  composio: {
    id: 'composio',
    sort: 1,
    beta: true,
    comingSoon: false,
    name: 'Composio',
    description: 'Enable Composio-backed integrations and 10,000 more integrations will appear for your agent. This acts as a master switch for Composio tool visibility.',
    category: 'AI Infrastructure',
    icon: '🧩',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2026-02-27 23:00:00',
    developer: 'Sulla',
    formGuide: 'Enable this integration and provide your Composio API credentials below to expose Composio-powered tools.',
    installationGuide: {
      title: 'Composio Enablement Guide',
      description: 'Turn on Composio tooling for your workspace (2-5 minutes)',
      steps: [
        {
          title: 'Set Composio Credentials',
          content: `1. Generate an API key in your Composio dashboard
2. Paste it into the Composio API Key field below
3. (Optional) Set Composio Base URL if using a non-default Composio environment`
        },
        {
          title: 'Enable Composio Integration',
          content: `1. Open Integrations and select Composio
2. Toggle connection to enabled
3. Open Skills/Tool search and confirm Composio tools are visible`
        }
      ],
      importantNotes: [
        'Composio-backed tools remain hidden unless this integration is connected',
        'This integration does not replace per-integration credentials for external services',
        'You still need to connect each individual service (e.g. Slack, Gmail, Notion) to execute its tools'
      ]
    },
    media: [],
    features: [
      {
        title: 'Master Visibility Switch',
        description: 'Controls whether Composio-provided tools are exposed to the agent'
      },
      {
        title: 'Centralized Tooling Layer',
        description: 'Enables access to the Composio-backed integration tool ecosystem'
      }
    ],
    guideLinks: [
      {
        title: 'Composio Dashboard',
        description: 'Create and manage your Composio API keys and projects',
        url: 'https://app.composio.dev/'
      },
      {
        title: 'Composio Docs',
        description: 'Official Composio documentation and auth setup guides',
        url: 'https://docs.composio.dev/'
      }
    ],
    properties: [
      {
        key: 'api_key',
        title: 'Composio API Key',
        hint: 'Create this in your Composio dashboard (Settings → API Keys).',
        type: 'password',
        required: true,
        placeholder: 'cmp_...'
      },
      {
        key: 'base_url',
        title: 'Composio Base URL',
        hint: 'Optional. Leave blank to use Composio default (production).',
        type: 'url',
        required: false,
        placeholder: 'https://backend.composio.dev'
      }
    ]
  },

  grok: {
    id: 'grok',
    sort: 2,
    beta: false,
    comingSoon: false,
    name: 'Grok',
    description: 'Connect xAI Grok models for agent prompts and completions.',
    category: 'AI Infrastructure',
    icon: '🚀',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2026-02-28 11:42:00',
    developer: 'xAI',
    formGuide: 'Paste your xAI API key to enable Grok model access.',
    properties: [
      {
        key: 'api_key',
        title: 'xAI API Key',
        hint: 'Generate this in your xAI developer console.',
        type: 'password',
        required: true,
        placeholder: 'xai-...'
      },
      {
        key: 'model',
        title: 'Model',
        hint: 'Select a Grok model to use for completions.',
        type: 'select',
        required: true,
        placeholder: 'Select a model...',
        selectBoxId: 'grok_models',
        selectDependsOn: ['api_key']
      }
    ]
  },

  anthropic: {
    id: 'anthropic',
    sort: 3,
    beta: false,
    comingSoon: false,
    name: 'Anthropic',
    description: 'Connect Anthropic Claude models for reasoning and assistant tasks.',
    category: 'AI Infrastructure',
    icon: '🧠',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2026-02-28 11:42:00',
    developer: 'Anthropic',
    formGuide: 'Paste your Anthropic API key to enable Claude model access.',
    properties: [
      {
        key: 'api_key',
        title: 'Anthropic API Key',
        hint: 'Generate this in your Anthropic Console.',
        type: 'password',
        required: true,
        placeholder: 'sk-ant-...'
      },
      {
        key: 'model',
        title: 'Model',
        hint: 'Select a Claude model to use for completions.',
        type: 'select',
        required: true,
        placeholder: 'Select a model...',
        selectBoxId: 'anthropic_models',
        selectDependsOn: ['api_key']
      }
    ]
  },

  openai: {
    id: 'openai',
    sort: 4,
    beta: false,
    comingSoon: false,
    name: 'OpenAI',
    description: 'Connect OpenAI models for chat, reasoning, and multimodal generation.',
    category: 'AI Infrastructure',
    icon: '🤖',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2026-02-28 11:42:00',
    developer: 'OpenAI',
    formGuide: 'Paste your OpenAI API key to enable model access.',
    properties: [
      {
        key: 'api_key',
        title: 'OpenAI API Key',
        hint: 'Generate this in your OpenAI dashboard.',
        type: 'password',
        required: true,
        placeholder: 'sk-...'
      },
      {
        key: 'model',
        title: 'Model',
        hint: 'Select an OpenAI model to use for completions.',
        type: 'select',
        required: true,
        placeholder: 'Select a model...',
        selectBoxId: 'openai_models',
        selectDependsOn: ['api_key']
      }
    ]
  },

  kimi: {
    id: 'kimi',
    sort: 5,
    beta: false,
    comingSoon: false,
    name: 'Kimi',
    description: 'Connect Kimi models (Moonshot AI) for long-context generation tasks.',
    category: 'AI Infrastructure',
    icon: '🌙',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2026-02-28 11:42:00',
    developer: 'Moonshot AI',
    formGuide: 'Paste your Kimi API key to enable Moonshot model access.',
    properties: [
      {
        key: 'api_key',
        title: 'Kimi API Key',
        hint: 'Generate this in your Moonshot/Kimi developer console.',
        type: 'password',
        required: true,
        placeholder: 'kimi-...'
      },
      {
        key: 'model',
        title: 'Model',
        hint: 'Select a Kimi/Moonshot model to use.',
        type: 'select',
        required: true,
        placeholder: 'Select a model...',
        selectBoxId: 'kimi_models',
        selectDependsOn: ['api_key']
      }
    ]
  },

  nvidia: {
    id: 'nvidia',
    sort: 6,
    beta: false,
    comingSoon: false,
    name: 'NVIDIA',
    description: 'Connect NVIDIA NIM and hosted inference endpoints for AI workloads.',
    category: 'AI Infrastructure',
    icon: '🟢',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2026-02-28 11:42:00',
    developer: 'NVIDIA',
    formGuide: 'Paste your NVIDIA API key to enable NIM/inference endpoint access.',
    properties: [
      {
        key: 'api_key',
        title: 'NVIDIA API Key',
        hint: 'Generate this in NVIDIA Build / NGC account settings.',
        type: 'password',
        required: true,
        placeholder: 'nvapi-...'
      },
      {
        key: 'model',
        title: 'Model',
        hint: 'Select an NVIDIA model to use.',
        type: 'select',
        required: true,
        placeholder: 'Select a model...',
        selectBoxId: 'nvidia_models',
        selectDependsOn: ['api_key']
      }
    ]
  },

  ollama: {
    id: 'ollama',
    sort: 7,
    beta: false,
    comingSoon: false,
    name: 'Ollama',
    description: 'Connect to a local or remote Ollama server for chat and embedding models.',
    category: 'AI Infrastructure',
    icon: '🦙',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2026-02-28 12:45:00',
    developer: 'Ollama',
    formGuide: 'Set your Ollama base URL, then choose both a generation model and an embed-text model.',
    properties: [
      {
        key: 'base_url',
        title: 'Ollama Base URL',
        hint: 'URL to your Ollama server. Defaults to http://127.0.0.1:11434 if omitted by your runtime.',
        type: 'url',
        required: true,
        placeholder: 'http://127.0.0.1:11434'
      },
      {
        key: 'model',
        title: 'Model',
        hint: 'Select the Ollama model used for chat/completions.',
        type: 'select',
        required: true,
        placeholder: 'Select a model...',
        selectBoxId: 'ollama_models',
        selectDependsOn: ['base_url']
      },
      {
        key: 'embed_text_model',
        title: 'Embed Text Model',
        hint: 'Select the model used for text embeddings.',
        type: 'select',
        required: true,
        placeholder: 'Select an embedding model...',
        selectBoxId: 'ollama_embed_text_models',
        selectDependsOn: ['base_url']
      }
    ]
  },

  custom: {
    id: 'custom',
    sort: 8,
    beta: false,
    comingSoon: false,
    name: 'Custom',
    description: 'Connect a custom AI provider endpoint using your own base URL.',
    category: 'AI Infrastructure',
    icon: '🛠️',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2026-02-28 11:46:00',
    developer: 'Custom',
    formGuide: 'Enter the base URL for your custom AI provider endpoint.',
    properties: [
      {
        key: 'base_url',
        title: 'Base URL',
        hint: 'Required. Provide the API base URL for your custom AI provider.',
        type: 'url',
        required: true,
        placeholder: 'https://api.example.com/v1'
      },
      {
        key: 'model',
        title: 'Model',
        hint: 'Select a model from your custom endpoint (fetched from /models).',
        type: 'select',
        required: false,
        placeholder: 'Select a model...',
        selectBoxId: 'custom_models',
        selectDependsOn: ['base_url', 'api_key']
      }
    ]
  },

};
