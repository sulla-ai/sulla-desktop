import type { BaseThreadState, NodeResult } from './Graph';
import type { ToolResult, ToolCall, ThreadState } from '../types';
import type { WebSocketMessageHandler } from '../services/WebSocketClientService';
import { getCurrentMode, getLocalService, getService } from '../languagemodels';
import { parseJson } from '../services/JsonParseService';
import { getWebSocketClientService } from '../services/WebSocketClientService';
import { SullaSettingsModel } from '../database/models/SullaSettingsModel';
import { BaseLanguageModel, ChatMessage, NormalizedResponse } from '../languagemodels/BaseLanguageModel';
import { abortIfSignalReceived, throwIfAborted } from '../services/AbortService';
import { tools, toolRegistry } from '../tools';
import { BaseTool } from '../tools/base';
import { Article } from '../database/models/Article';
import { ConversationSummaryService } from '../services/ConversationSummaryService';
import { ObservationalSummaryService } from '../services/ObservationalSummaryService';

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

const DEFAULT_WS_CHANNEL = 'dreaming-protocol';

export const JSON_ONLY_RESPONSE_INSTRUCTIONS = `When you respond it will be parsed as JSON and ONLY the following object will be read.
Any text outside this exact structure will break downstream parsing.\nRespond ONLY with this valid JSON — nothing before, nothing after, no fences, no commentary:`;

export const TOOLS_RESPONSE_JSON = `  "tools": [
    ["tool_name", "arg1", "arg2"] - run any tool with exec form
    ["emit_chat_message", "Respond to the users inquiry"]
  ],`;

export const OBSERVATIONAL_MEMORY_SOP = `### SOP: add_observational_memory

Call **immediately** when **any** of these triggers fire:

Must-call triggers:
1. User expresses/changes preference, goal, constraint, hard no, identity signal, desired name/nickname
2. User commits (deadline, budget, deliverable, strategy, “from now on”, “always/never again”)
3. Recurring pattern confirmed in user requests/behavior
4. Breakthrough, major insight, painful lesson (yours or user’s)
5. You create/edit/delete/rename/configure anything persistent (article, memory, event, setting, container, agent, workflow, prompt, tool, integration)
6. Important new/confirmed info about tools, environment, APIs, limits, capabilities
7. High-value tool result that will shape future reasoning

Priority (pick exactly one):
🔴 Critical   = identity, strong prefs/goals, promises, deal-breakers, core constraints
🟡 Valuable   = decisions, patterns, reusable tool outcomes, progress markers
⚪ Low        = transient/minor (almost never use)

Content rules – enforced:
- Exactly one concise sentence
- Third-person/neutral voice only (“Human prefers…”, “User committed to…”)
- No “I” or “you”
- Always include specifics when they exist: dates, numbers, names, versions, exact phrases, URLs
- Maximize signal per character – never vague`;

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

export interface LLMCallOptions {
    model?: string;
    maxTokens?: number;
    format?: 'json' | undefined;
    temperature?: number;
    signal?: AbortSignal;
    disableTools?: boolean;
    nodeRunPolicy?: NodeRunPolicy;
    nodeRunMessages?: {
      assistantMessages?: ChatMessage[];
      userMessages?: ChatMessage[];
      systemPrompt?: string;
    };
    allowedToolCategories?: string[];
    allowedToolNames?: string[];
}

export interface NodeRunPolicy {
    messageSource?: 'graph' | 'node-local' | 'custom';
    persistAssistantToGraph?: boolean;
    persistToolResultsToGraph?: boolean;
    persistAssistantToNodeState?: boolean;
    persistToolResultsToNodeState?: boolean;
    nodeStateNamespace?: string;
    includeGraphAssistantMessages?: boolean;
    includeGraphUserMessages?: boolean;
}

export interface NodeRunContext {
    runId: string;
    nodeId: string;
    nodeName: string;
    messages: ChatMessage[];
    toolTranscript: Array<{ toolName: string; success: boolean; result?: unknown; error?: string }>;
    hadToolCalls: boolean;
    hadUserMessages: boolean;
    policy: Required<NodeRunPolicy>;
}

export interface LLMResponse {
    content: string | Record<string, any>;
    model: string;
}

export interface PromptEnrichmentOptions {
  includeSoul?: boolean;
  includeAwareness?: boolean;
  includeEnvironment?: boolean;
  includeMemory?: boolean;
  includeTools?: boolean;
  includeStrategicPlan?: boolean;
  includeTacticalPlan?: boolean;
  includeKnowledgebasePlan?: boolean;
  includeKnowledgeBaseSections?: boolean;
}

export interface StructuredArticlePreparationOptions {
    fallbackSlugSource: string;
    fallbackTitle: string;
    fallbackHeader: string;
    defaultSection?: string;
    defaultCategory?: string;
    defaultTags?: string[];
    placeholderPattern?: RegExp;
}


// ============================================================================
// Supporting functions
// ============================================================================

async function getSoulPrompt(): Promise<string> {
  const prompt = await SullaSettingsModel.get('soulPrompt', '');
  const botName = await SullaSettingsModel.get('botName', 'Sulla');
  const primaryUserName = await SullaSettingsModel.get('primaryUserName', '');

  // Build prefix with bot name and optional user name
  const prefix = primaryUserName.trim()
    ? `You are Sulla Desktop, and you like to be called ${botName}\nThe Human's name is: ${primaryUserName}\n\n`
    : `You are Sulla Desktop, and you like to be called ${botName}\n\n`;

  return prefix + prompt;
}


export const ENVIRONMENT_PROMPT = `Core Identity & Principles and Environment & Tools

## Tool responses
Tool responses are delivered back as assistant messages.

## Persistent Environment & Tools
The agent operates inside a custom runtime that contains the following built-in persistent systems.

Current datetime: {{formattedTime}}
Computer time zone: {{timeZone}}

### Calendar System
The calendar system is the single source of truth for all time-based actions. Reminders, meetings, recurring reports, and scheduled tasks are stored as calendar events. Events automatically trigger at the scheduled time and provide full context.

### Observational Memory (short-term context layer)
Observational Memory is the short-term context layer. It consists of timestamped snapshot entries delivered as assistant messages.

Each entry follows this exact structure:
- A UTC timestamp in ISO format (YYYY-MM-DDTHH:MM:SS.sssZ)
- A status indicator (🔴 for significant or confirmed events, 🟡 for finalized or completed milestones)
- One or more neutral factual sentences that record user requests, confirmations, formal submissions, or task state changes
- Optional reference slugs that link to related long-term memory items

The current Observational Memory snapshot contains repeated chronological records of user confirmations and formal requests for the specific n8n workflow PRD titled “daily X/Twitter + RSS + GitHub AI intelligence monitor” that uses Sulla’s local AI endpoint[](http://host.docker.internal:3000/v1/chat/completions), stores curated dated reports to long-term memory, and delivers a Slack digest for YouTube topic ideation.

Additional entries are created automatically when significant user interactions, repeated confirmations, finalized requests, or major progress milestones occur. The full current snapshot is always included in the context for continuity.

### Long-term Memory (vector database)
Long-term Memory is the core knowledge base and identity store. It contains:
- SOPs and skills
- Project documentation in solutions-architect format (user stories, MoSCoW priorities, architecture, acceptance criteria)
- Wikipedia-style reference pages on people, companies, projects, friends, customers, businesses, families, and events
- Project resource documents that serve as the source of truth for each active project

### Workspaces
Workspaces are dedicated folders in the user data directory for persistent files and development work. One workspace exists per project. They store code, assets, and outputs. Access occurs via list and read tools. Commands execute with full absolute paths.

### Docker Environment
The runtime runs on Docker with full host access. Safe containers and images from the internet can be launched. Workspace directories are mounted into containers via docker-compose for hot reloading.

### Automation Workflows (n8n)
n8n is the automation workflow engine. It includes access to thousands of community templates.

### Tools
Built-in tools exist across multiple categories: {{tool_categories}}.  
The browse_tools tool lists all available tools.  
The exec tool runs system commands when no dedicated tool exists.

### OpenAI Compatible API
An OpenAI-compatible API server runs locally in this environment.
- From the parent machine: http://localhost:3000
- From inside Docker containers: http://host.docker.internal:3000
All endpoints are prefixed with /v1/.

### Codebase
Your agent codebase is located at https://github.com/sulla-ai/sulla-desktop.  
Architecture and system documentation reside in the /doc folder.

`;

// ============================================================================
// Primary Classes
// ============================================================================

/**
 * 
 */
export abstract class BaseNode<T extends BaseThreadState = BaseThreadState> {
    id: string;
    name: string;
    protected llm: BaseLanguageModel | null = null;
    private currentNodeRunContext: NodeRunContext | null = null;

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }

    abstract execute(state: T): Promise<NodeResult<T>>;

    protected bumpStateVersion(_state: BaseThreadState): void {
        // Version tracking removed: state mutations are applied on live references.
    }

    /**
     * 
     * @param basePrompt 
     * @param state 
     * @param options 
     * @returns 
     */
    protected async enrichPrompt(
        basePrompt: string,
        state: ThreadState,
        options: PromptEnrichmentOptions,
    ): Promise<string> {

        const parts: string[] = [];

        if (options.includeSoul) {
            const soulPrompt = await getSoulPrompt();
            if (soulPrompt.trim()) {
                parts.push(soulPrompt);
            }
        }

        // Always preserve the caller's base prompt and enrich around it.
        if (basePrompt?.trim()) {
            parts.push(basePrompt.trim());
        }

        let AwarenessMessage = ENVIRONMENT_PROMPT;

            /////////////////////////////////////////////////////////////////
            // add the tool categories
            /////////////////////////////////////////////////////////////////
            const categoriesWithDesc = toolRegistry.getCategoriesWithDescriptions();
            const categoriesText = categoriesWithDesc.map(({category, description}) => `- ${category}: ${description}`).join('\n');
            AwarenessMessage = AwarenessMessage.replace('{{tool_categories}}', categoriesText);


            /////////////////////////////////////////////////////////////////
            // adds the users time
            /////////////////////////////////////////////////////////////////
            const now = new Date();
            const formattedTime = now.toLocaleString('en-US', {
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
            });
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';

            AwarenessMessage = AwarenessMessage.replace('{{formattedTime}}', formattedTime);
            AwarenessMessage = AwarenessMessage.replace('{{timeZone}}', timeZone);

        if (options.includeEnvironment !== false) {
            parts.push(AwarenessMessage);
        }

        /////////////////////////////////////////////////////////////////
        // adds observational memories to the message thread
        /////////////////////////////////////////////////////////////////
        if (options.includeAwareness) {
            if (state.metadata.awarenessIncluded !== true) {

                const observationalMemory = await SullaSettingsModel.get('observationalMemory', {});
                let memoryObj: any;
                let memoryText: string = '';

                try {
                    memoryObj = parseJson(observationalMemory);
                } catch (e) {
                    console.error('Failed to parse observational memory:', e);
                    memoryObj = {};
                }

                // Format observational memory into readable text
                if (Array.isArray(memoryObj)) {
                    memoryText = memoryObj.map((entry: any) => 
                        `${entry.priority} ${entry.timestamp} ${entry.content}`
                    ).join('\n');
                }
                
                state.messages.push({
                    role: 'assistant',
                    content: `\nYour Observational Memory Storage:\n${memoryText}`,
                    metadata: {
                        nodeId: this.id,
                        timestamp: Date.now()
                    }
                });
                this.bumpStateVersion(state);
                state.metadata.awarenessIncluded = true;
            }

            parts.push(OBSERVATIONAL_MEMORY_SOP);
        }
        

        /////////////////////////////////////////////////////////////////
        // adds instructions for the planning graph
        /////////////////////////////////////////////////////////////////
        if (options.includeStrategicPlan) {
            const planBlock = this.buildStrategicPlanContextBlock(state);
            if (planBlock) {
                state.messages.push({
                    role: 'assistant',
                    content: planBlock,
                    metadata: {
                        nodeId: this.id,
                        timestamp: Date.now()
                    }
                });
                this.bumpStateVersion(state);
            }
        }

        if (options.includeTacticalPlan) {
            const planBlock = this.buildTacticalPlanContextBlock(state);
            if (planBlock) {
                state.messages.push({
                    role: 'assistant',
                    content: planBlock,
                    metadata: {
                        nodeId: this.id,
                        timestamp: Date.now()
                    }
                });
                this.bumpStateVersion(state);
            }
        }

        /////////////////////////////////////////////////////////////////
        // adds instructions for the knowledgebase node graph
        /////////////////////////////////////////////////////////////////
        if (options.includeKnowledgeBaseSections) {
            try {
                const { SectionsRegistry } = await import('../database/registry/SectionsRegistry');
                const registry = SectionsRegistry.getInstance();
                const sections = await registry.getSectionsWithCategories();

                if (sections.length > 0) {
                    const sectionsTree = this.formatSectionsTree(sections);
                    parts.push(`Knowledge Base Organization Structure:\n${sectionsTree}\n\nWhen creating articles, choose the most appropriate section and category from this structure. Only create new sections/categories if they provide significant organizational benefit.`);
                }
            } catch (error) {
                console.warn('[BaseNode] Failed to load knowledge base sections:', error);
            }
        }

        return parts.join('\n\n');
    }

    /**
     * 
     * @param state 
     * @param systemPrompt 
     * @param options 
     * @returns 
     */
    protected async chat(
        state: BaseThreadState,
        systemPrompt: string,
        options: LLMCallOptions = {}
    ): Promise<any | null> {
        const reply = await this.normalizedChat(state, systemPrompt, options);
        if (!reply) return null;
        if (options.format === 'json') {
            const parsedReply = this.parseJson(reply.content);
            console.log(`[${this.name}] Parsed JSON in method:chat:`, parsedReply);
            return parsedReply;
        }
        return reply.content;
    }

    protected triggerBackgroundStateMaintenance(state: BaseThreadState): void {
        ConversationSummaryService.triggerBackgroundSummarization(state);
        ObservationalSummaryService.triggerBackgroundTrimming(state);
    }

    /**
     * Unified chat: takes state + new system prompt + user message.
     * - Replaces last system prompt (or appends new one)
     * - Appends user message
     * - Calls primary LLM
     * - On any error/failure → fallback to local Ollama if remote
     * - Appends assistant response to state.messages
     * - Parses JSON if format='json'
     * - No raw response logging
     */
    protected async normalizedChat(
        state: BaseThreadState,
        systemPrompt: string,
        options: LLMCallOptions = {}
    ): Promise<NormalizedResponse | null> {
        
        const context = state.metadata.llmLocal ? 'local' : 'remote';
        this.llm = await getService(context, state.metadata.llmModel);

        const nodeRunContext = this.createNodeRunContext(state, {
            systemPrompt,
            policy: options.nodeRunPolicy,
            assistantMessages: options.nodeRunMessages?.assistantMessages,
            userMessages: options.nodeRunMessages?.userMessages,
            systemMessageOverride: options.nodeRunMessages?.systemPrompt,
        });

        const callToolAccessPolicy = this.buildToolAccessPolicyForCall(options);
        const messages = [...nodeRunContext.messages];

        // Check for abort before making LLM calls
        throwIfAborted(state, 'Chat operation aborted');
        
        // Build dynamic LLM tools: meta category + found tools (set by browse_tools if found)
        // Skip tool loading if tools are explicitly disabled
        let llmTools: any[] = [];
        if (!options.disableTools) {
          llmTools = (state as any).llmTools;
          if (!llmTools && state.foundTools?.length) {
            // Fallback: convert foundTools to LLM format if llmTools wasn't set
            const metaLLMTools = await toolRegistry.getLLMToolsFor(await toolRegistry.getToolsByCategory("meta"));
            const foundLLMTools = await Promise.all(state.foundTools.map((tool: any) => toolRegistry.convertToolToLLM(tool.name)));
            llmTools = [...metaLLMTools, ...foundLLMTools];
          }
          if (!llmTools) {
            // Final fallback to just meta tools
            llmTools = await toolRegistry.getLLMToolsFor(await toolRegistry.getToolsByCategory("meta"));
          }

          const filtered = await this.filterLLMToolsByAccessPolicy(llmTools, options);
          llmTools = filtered.tools;
        }

        const previousToolAccessPolicy = (state.metadata as any).__toolAccessPolicy;
        (state.metadata as any).__toolAccessPolicy = callToolAccessPolicy;

        const systemMessage = messages.find(msg => msg.role === 'system');
        console.log(`[BaseNode:${this.name}] prompt:`, systemMessage ? systemMessage.content : 'No system message');
        const conversationId = typeof state.metadata.threadId === 'string' ? state.metadata.threadId : undefined;
        const nodeName = this.name;
        const previousRunContext = this.currentNodeRunContext;
        this.currentNodeRunContext = nodeRunContext;
        try {
            // Primary attempt
            state.metadata.hadToolCalls = false;
            state.metadata.hadUserMessages = false;
            let reply: NormalizedResponse | null = await this.llm.chat(messages, {
                model: state.metadata.llmModel,
                maxTokens: options.maxTokens,
                format: options.format,
                temperature: options.temperature,
                signal: (state as any).metadata?.__abort?.signal,
                tools: llmTools,
                conversationId,
                nodeName,
            });

            if (!reply) throw new Error('No response from primary LLM');

            // Append to state
            this.appendResponse(state, reply.content);

            // Send token information to AgentPersona
            this.dispatchTokenInfoToAgentPersona(state, reply);
            
            // Handle tool calls using the unified executeToolCalls method
            const toolCalls = reply.metadata.tool_calls || [];
            if (toolCalls.length) {
                console.log(`[${this.name}] Processing ${toolCalls.length} tool calls via executeToolCalls`);
                const allowedToolNames = await this.getAllowedToolNamesForExecution(llmTools);
                await this.executeToolCalls(state, toolCalls, allowedToolNames);
            }

            this.triggerBackgroundStateMaintenance(state);

            return reply;
        } catch (err) {
            if ((err as any)?.name === 'AbortError') throw err;

            console.warn(`[${this.name}:BaseNode] Primary LLM failed:`, err instanceof Error ? err.message : String(err));

            // Fallback only if primary was remote
            const mode = await getCurrentMode();
            if (mode !== 'local') {
                try {
                    const ollama = await getLocalService();
                    if (ollama.isAvailable()) {
                        // Filter messages to only include ChatMessage-compatible roles
                        const chatMessages = messages.filter(msg =>
                            ['system', 'user', 'assistant'].includes(msg.role)
                        ) as ChatMessage[];
                        const reply = await ollama.chat(chatMessages, { 
                            signal: options.signal,
                            temperature: options.temperature,
                            maxTokens: options.maxTokens,
                            format: options.format,
                            conversationId,
                            nodeName,
                        });
                        if (reply) {
                            this.appendResponse(state, reply.content);
                            this.triggerBackgroundStateMaintenance(state);
                            return reply;
                        }
                    }
                } catch (fallbackErr) {
                    console.error(`[${this.name}:BaseNode] Ollama fallback failed:`, fallbackErr);
                }
            }

            return null;
        } finally {
            this.currentNodeRunContext = previousRunContext;
            (state.metadata as any).__toolAccessPolicy = previousToolAccessPolicy;
        }
    }

    private buildToolAccessPolicyForCall(options: LLMCallOptions): {
        allowedCategories: string[] | null;
        allowedToolNames: string[] | null;
    } {
        const allowedCategories = options.allowedToolCategories?.length
            ? [...new Set(options.allowedToolCategories)]
            : null;
        const allowedToolNames = options.allowedToolNames?.length
            ? [...new Set(options.allowedToolNames)]
            : null;

        return {
            allowedCategories,
            allowedToolNames,
        };
    }

    private async filterLLMToolsByAccessPolicy(
        llmTools: any[],
        options: LLMCallOptions,
    ): Promise<{ tools: any[] }> {
        const hasRestrictions = Boolean(options.allowedToolCategories?.length || options.allowedToolNames?.length);

        if (!hasRestrictions || !Array.isArray(llmTools) || llmTools.length === 0) {
            return { tools: llmTools || [] };
        }

        const allowedToolNamesSet = options.allowedToolNames?.length
            ? new Set(options.allowedToolNames)
            : null;
        const allowedCategoriesSet = options.allowedToolCategories?.length
            ? new Set(options.allowedToolCategories)
            : null;
        const filteredTools: any[] = [];
        for (const llmTool of llmTools) {
            const toolName = llmTool?.function?.name;
            if (!toolName) {
                continue;
            }

            if (allowedToolNamesSet && !allowedToolNamesSet.has(toolName)) {
                continue;
            }

            const toolInstance = await toolRegistry.getTool(toolName);
            const category = String(toolInstance?.metadata?.category || '').trim();
            if (allowedCategoriesSet && !allowedCategoriesSet.has(category)) {
                continue;
            }

            filteredTools.push(llmTool);
        }

        return { tools: filteredTools };
    }

    private async getAllowedToolNamesForExecution(llmTools: any[]): Promise<string[] | undefined> {
        if (!Array.isArray(llmTools) || llmTools.length === 0) {
            return undefined;
        }

        const names = llmTools
            .map(tool => tool?.function?.name)
            .filter((name): name is string => Boolean(name));

        return names.length > 0 ? names : undefined;
    }

    protected getDefaultNodeRunPolicy(): Required<NodeRunPolicy> {
        return {
            messageSource: 'graph',
            persistAssistantToGraph: true,
            persistToolResultsToGraph: true,
            persistAssistantToNodeState: false,
            persistToolResultsToNodeState: false,
            nodeStateNamespace: '',
            includeGraphAssistantMessages: true,
            includeGraphUserMessages: true,
        };
    }

    private appendNodeScopedMessage(state: BaseThreadState, message: ChatMessage, messageType: 'assistant' | 'tool'): void {
        if (!this.currentNodeRunContext) {
            return;
        }

        const policy = this.currentNodeRunContext.policy;
        let namespace = String(policy.nodeStateNamespace || '').trim();
        if (!namespace) {
            namespace = `__messages_${this.id}`;
        }
        if (!namespace) {
            return;
        }

        this.ensureNodeMessageLaneInitializedFromGraph(state, namespace);

        const shouldPersist = messageType === 'assistant'
            ? (policy.persistAssistantToNodeState || !policy.persistAssistantToGraph)
            : (policy.persistToolResultsToNodeState || !policy.persistToolResultsToGraph);

        if (!shouldPersist) {
            return;
        }

        const metadataAny = state.metadata as any;
        if (!metadataAny[namespace] || typeof metadataAny[namespace] !== 'object') {
            metadataAny[namespace] = {};
        }

        if (!Array.isArray(metadataAny[namespace].messages)) {
            metadataAny[namespace].messages = [];
        }

        const persistedMessage: ChatMessage = messageType === 'tool'
            ? {
                role: 'assistant',
                content: message.content,
                metadata: {
                    ...(message.metadata || {}),
                    originalRole: 'tool',
                },
            }
            : { ...message };

        metadataAny[namespace].messages.push(persistedMessage);
        this.bumpStateVersion(state);
    }

    private ensureNodeMessageLaneInitializedFromGraph(state: BaseThreadState, namespace: string): void {
        const metadataAny = state.metadata as any;
        if (!metadataAny[namespace] || typeof metadataAny[namespace] !== 'object') {
            metadataAny[namespace] = {};
        }

        if (metadataAny[namespace].graphSeedInitialized === true) {
            if (!Array.isArray(metadataAny[namespace].messages)) {
                metadataAny[namespace].messages = [];
            }
            return;
        }

        const graphMessages = Array.isArray(state.messages)
            ? state.messages.map((msg) => ({ ...msg }))
            : [];

        metadataAny[namespace].messages = graphMessages;
        metadataAny[namespace].graphSeedInitialized = true;
    }

    protected buildAssistantMessagesForNode(
        state: BaseThreadState,
        policy: Required<NodeRunPolicy>,
        override?: ChatMessage[],
    ): ChatMessage[] {
        if (override) {
            const overrideAssistant = override.filter(msg => msg.role === 'assistant').map(msg => ({ ...msg }));
            if (!policy.includeGraphAssistantMessages) {
                return overrideAssistant;
            }

            const graphAssistant = (state.messages || [])
                .filter(msg => msg.role === 'assistant')
                .map(msg => ({ ...msg }));

            return [...graphAssistant, ...overrideAssistant];
        }

        if (!policy.includeGraphAssistantMessages) {
            return [];
        }

        return (state.messages || [])
            .filter(msg => msg.role === 'assistant')
            .map(msg => ({ ...msg }));
    }

    protected buildUserMessagesForNode(
        state: BaseThreadState,
        policy: Required<NodeRunPolicy>,
        override?: ChatMessage[],
    ): ChatMessage[] {
        if (override) {
            const overrideUser = override.filter(msg => msg.role === 'user').map(msg => ({ ...msg }));
            if (!policy.includeGraphUserMessages) {
                return overrideUser;
            }

            const graphUser = (state.messages || [])
                .filter(msg => msg.role === 'user')
                .map(msg => ({ ...msg }));

            return [...graphUser, ...overrideUser];
        }

        if (!policy.includeGraphUserMessages) {
            return [];
        }

        return (state.messages || [])
            .filter(msg => msg.role === 'user')
            .map(msg => ({ ...msg }));
    }

    protected buildSystemPromptForNode(systemPrompt: string, override?: string): ChatMessage {
        const content = (override ?? systemPrompt ?? '').trim();
        return {
            role: 'system',
            content,
        };
    }

    protected createNodeRunContext(
        state: BaseThreadState,
        input: {
            systemPrompt: string;
            policy?: NodeRunPolicy;
            assistantMessages?: ChatMessage[];
            userMessages?: ChatMessage[];
            systemMessageOverride?: string;
        },
    ): NodeRunContext {
        const defaults = this.getDefaultNodeRunPolicy();
        const policy: Required<NodeRunPolicy> = {
            ...defaults,
            ...(input.policy || {}),
        };

        let namespace = String(policy.nodeStateNamespace || '').trim();
        if (!namespace) {
            namespace = `__messages_${this.id}`;
        }
        if (namespace) {
            this.ensureNodeMessageLaneInitializedFromGraph(state, namespace);
        }

        const systemMessage = this.buildSystemPromptForNode(input.systemPrompt, input.systemMessageOverride);
        let mergedMessages: ChatMessage[] = [];

        if (policy.messageSource === 'graph' && !input.assistantMessages && !input.userMessages) {
            mergedMessages = [
                ...(state.messages || []).filter(msg => msg.role !== 'system').map(msg => ({ ...msg })),
                systemMessage,
            ];
        } else if (policy.messageSource === 'node-local' && this.currentNodeRunContext?.messages?.length) {
            mergedMessages = [
                ...this.currentNodeRunContext.messages
                    .filter(msg => msg.role !== 'system')
                    .map(msg => ({ ...msg })),
                systemMessage,
            ];
        } else {
            const assistantMessages = this.buildAssistantMessagesForNode(state, policy, input.assistantMessages);
            const userMessages = this.buildUserMessagesForNode(state, policy, input.userMessages);
            mergedMessages = [
                ...assistantMessages,
                ...userMessages,
                systemMessage,
            ];
        }

        return {
            runId: `${this.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            nodeId: this.id,
            nodeName: this.name,
            messages: mergedMessages,
            toolTranscript: [],
            hadToolCalls: false,
            hadUserMessages: false,
            policy,
        };
    }

    /**
     * Clears out any thinking context
     * Parses JSON with our best attempt parser
     * 
     * @param raw 
     * @returns 
     */
    protected parseJson<T = unknown>(raw: string | null | undefined): T | null {
        // If it's already an object, return it as-is
        if (typeof raw === 'object') {
            return raw as T;
        }
        if (!raw || typeof raw !== 'string') return null;

        return parseJson(raw);
    }

    protected prepareArticleFromStructuredOutput(
        rawOutput: string,
        options: StructuredArticlePreparationOptions,
    ): { meta: Record<string, any>; document: string } {
        const normalizedOutput = this.normalizeStructuredOutput(rawOutput);
        const fmMatch = normalizedOutput.match(/---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)/);
        const rawMeta = fmMatch ? this.parseYamlFrontmatter(fmMatch[1]) : {};

        const sanitizedFallbackSlug = this.sanitizeText(options.fallbackSlugSource, options.placeholderPattern);
        const rawSlug = this.sanitizeText(rawMeta.slug || sanitizedFallbackSlug || options.fallbackHeader, options.placeholderPattern);
        let slug = this.normalizeSlug(rawSlug);

        if (!slug) {
            const headerSlug = this.normalizeSlug(options.fallbackHeader) || 'document';
            slug = `${headerSlug}-${Date.now()}`;
        }

        const title = this.sanitizeText(rawMeta.title || options.fallbackTitle || slug, options.placeholderPattern) || slug;
        const section = this.sanitizeText(rawMeta.section || options.defaultSection || 'Projects', options.placeholderPattern) || 'Projects';
        const category = this.sanitizeText(rawMeta.category || options.defaultCategory || 'Projects', options.placeholderPattern) || 'Projects';
        const defaultTags = options.defaultTags?.length ? options.defaultTags : ['skill'];
        const tags = this.sanitizeStringArray(rawMeta.tags, options.placeholderPattern).length
            ? this.sanitizeStringArray(rawMeta.tags, options.placeholderPattern)
            : defaultTags;
        const mentions = this.sanitizeStringArray(rawMeta.mentions, options.placeholderPattern);
        const relatedEntities = this.sanitizeStringArray(rawMeta.related_entities, options.placeholderPattern);
        const document = this.buildSafeDocumentBody(
            fmMatch?.[2],
            normalizedOutput,
            title,
            options.fallbackHeader,
            `${this.name} generated this document.`,
        );

        return {
            meta: {
                schemaversion: Number(rawMeta.schemaversion) || 1,
                slug,
                title,
                section,
                category,
                tags,
                mentions,
                related_entities: relatedEntities,
            },
            document,
        };
    }

    protected async saveArticleAsync(meta: Record<string, any>, document: string, nodeLabel: string): Promise<void> {
        try {
            const article = new Article();
            article.fill({
                schemaversion: meta.schemaversion,
                slug: meta.slug,
                title: meta.title,
                section: meta.section,
                category: meta.category,
                tags: meta.tags,
                mentions: meta.mentions,
                related_entities: meta.related_entities,
                document,
            });

            await article.save();
            console.log(`[${nodeLabel}] Saved article asynchronously: ${meta.slug}`);
        } catch (error) {
            console.warn(`[${nodeLabel}] Failed to save article asynchronously:`, error);
        }
    }

    protected normalizeStructuredOutput(content: string): string {
        const trimmed = String(content || '').trim();
        const fencedMatch = trimmed.match(/^```(?:markdown|md|yaml)?\s*\n([\s\S]*?)\n```$/i);
        return fencedMatch ? fencedMatch[1].trim() : trimmed;
    }

    protected parseYamlFrontmatter(frontmatter: string): Record<string, any> {
        const result: Record<string, any> = {};
        let currentArrayKey: string | null = null;

        for (const rawLine of frontmatter.split('\n')) {
            const line = rawLine.replace(/\t/g, '  ');
            const trimmed = line.trim();
            if (!trimmed) continue;

            const keyValueMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
            if (keyValueMatch) {
                const key = keyValueMatch[1];
                const value = keyValueMatch[2].trim();

                if (!value) {
                    result[key] = [];
                    currentArrayKey = key;
                    continue;
                }

                currentArrayKey = null;
                const unquoted = value.replace(/^"([\s\S]*)"$/, '$1').replace(/^'([\s\S]*)'$/, '$1');
                const inlineArrayMatch = unquoted.match(/^\[(.*)\]$/);
                if (inlineArrayMatch) {
                    result[key] = inlineArrayMatch[1]
                        .split(',')
                        .map(item => item.trim())
                        .filter(Boolean);
                    continue;
                }

                result[key] = unquoted;
                continue;
            }

            const arrayItemMatch = trimmed.match(/^-\s+(.*)$/);
            if (arrayItemMatch && currentArrayKey) {
                if (!Array.isArray(result[currentArrayKey])) {
                    result[currentArrayKey] = [];
                }
                result[currentArrayKey].push(arrayItemMatch[1].trim());
            }
        }

        return result;
    }

    protected sanitizeText(value: any, placeholderPattern?: RegExp): string {
        const text = String(value || '')
            .replace(/^"|"$/g, '')
            .replace(/^'|'$/g, '')
            .trim();

        if (!text) return '';

        const defaultPlaceholderPattern = /(your-|goes-here|slugs-to-|the\s+project\s+title|the\s+actin\s+step\s+name|the\s+category\s+this\s+would\s+fall\s+under)/i;
        const pattern = placeholderPattern || defaultPlaceholderPattern;
        if (pattern.test(text)) {
            return '';
        }

        return text;
    }

    protected sanitizeStringArray(value: any, placeholderPattern?: RegExp): string[] {
        const raw = Array.isArray(value)
            ? value
            : typeof value === 'string'
                ? value.split(',')
                : [];

        const out = raw
            .map(item => this.sanitizeText(item, placeholderPattern))
            .filter(Boolean);

        return Array.from(new Set(out));
    }

    protected buildSafeDocumentBody(
        body: string | undefined,
        source: string,
        title: string,
        fallbackHeader: string,
        fallbackDescription: string,
    ): string {
        const cleanedBody = String(body || '').trim();
        if (cleanedBody.length > 24) {
            return cleanedBody;
        }

        const strippedFrontmatter = source.replace(/---\s*\n[\s\S]*?\n---\s*\n?/m, '').trim();
        if (strippedFrontmatter.length > 24) {
            return strippedFrontmatter;
        }

        const safeTitle = title || fallbackHeader;
        return `# ${fallbackHeader}\n\nTitle: ${safeTitle}\n\n${fallbackDescription}`;
    }

    protected normalizeSlug(value: string): string {
        return String(value)
            .toLowerCase()
            .trim()
            .replace(/['"]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
 
    /**
     * Helper method to respond gracefully when abort is detected
     */
    protected async handleAbort(state: BaseThreadState, message?: string): Promise<void> {
        const abortMessage = message || "OK, I'm stopping everything. What do you need me to do?";
        this.wsChatMessage(state, abortMessage, 'assistant', 'progress');
    }

    /**
     * Build a context block showing strategic plan progress
     */
    protected buildStrategicPlanContextBlock(state: any): string | null {
        const plan = state.metadata.plan;
        if (!plan || !plan.model || !plan.milestones || plan.milestones.length === 0) {
            return null;
        }

        const goal = plan.model.attributes.goal || '';
        const goaldescription = plan.model.attributes.goaldescription || '';
        const activeIndex = plan.activeMilestoneIndex;

        const milestoneLines = plan.milestones.map((mWrapper: { model: { status?: string, title?: string } }, idx: number) => {
            const m = mWrapper.model;
            const status = m.status || 'pending';
            let statusIcon = '○';
            if (status === 'done') statusIcon = '✓';
            else if (status === 'in_progress') statusIcon = '→';
            else if (status === 'blocked') statusIcon = '✗';

            const isActive = idx === activeIndex || status === 'in_progress';
            const title = isActive ? `**${m.title}**` : m.title;

            return ` ${statusIcon} Milestone ${idx + 1}: ${title} [${status}]`;
        });

        return `## Strategic Plan\nGoal: ${goal}\nGoal Description: ${goaldescription}\n\n### Milestones:\n${milestoneLines.join('\n')}`;
    }

    /**
     * Build a context block showing tactical plan progress for current milestone
     */
    protected buildTacticalPlanContextBlock(state: any): string | null {
        const steps = state.metadata.currentSteps;
        if (!steps || steps.length === 0) {
            return null;
        }

        const activeIndex = state.metadata.activeStepIndex;

        const stepLines = steps.map((s:any, idx:number) => {
            const status = s.done ? 'done' : (idx === activeIndex ? 'in_progress' : 'pending');
            let statusIcon = '○';
            if (status === 'done') statusIcon = '✓';
            else if (status === 'in_progress') statusIcon = '→';

            const isActive = status === 'in_progress';
            const description = isActive ? `**${s.description}**` : s.description;

            return ` ${statusIcon} Step ${idx + 1}: ${description} [${status}]`;
        });

        return `#### Tactical Plan (Current Milestone)\nSteps:\n${stepLines.join('\n')}`;
    }

    /**
     * Build a context block showing knowledge base article progress and content
     */
    protected buildKnowledgeBaseContextBlock(state: any): string | null {
        const parts: string[] = [];

        // Action plan steps
        const steps = state.metadata.kbCurrentSteps || [];
        if (steps.length > 0) {
            const activeIndex = state.metadata.kbActiveStepIndex;
            const stepLines = steps.map((s: any, idx: number) => {
                const status = s.done ? 'done' : (idx === activeIndex ? 'in_progress' : 'pending');
                let statusIcon = '○';
                if (status === 'done') statusIcon = '✓';
                else if (status === 'in_progress') statusIcon = '→';

                const isActive = status === 'in_progress';
                const description = isActive ? `**${s.description}**` : s.description;

                return ` ${statusIcon} Step ${idx + 1}: ${description} [${status}]`;
            });

            parts.push(`### Action Plan\nSteps:\n${stepLines.join('\n')}`);
        }

        // Article schema
        const schema = state.metadata.kbArticleSchema || {};
        const schemaLines = Object.entries(schema).map(([key, value]) => {
            const valStr = Array.isArray(value) ? value.join(', ') : value?.toString() || 'Not set';
            return `- **${key}**: ${valStr}`;
        });
        if (schemaLines.length > 0) {
            parts.push(`### Article Schema\n${schemaLines.join('\n')}`);
        }

        // Article research (JSON block)
        const research = state.metadata.kbArticleResearch;
        if (research?.trim()) {
            parts.push(`### Article Research\n\`\`\`json\n${research.trim()}\n\`\`\``);
        }

        // Final content (Markdown block)
        const finalContent = state.metadata.kbFinalContent;
        if (finalContent?.trim()) {
            parts.push(`### Final Content\n\`\`\`markdown\n${finalContent.trim()}\n\`\`\``);
        }

        return parts.length > 0 ? parts.join('\n\n') : null;
    }

    /**
     * Format sections and categories as a hierarchical tree view
     */
    protected formatSectionsTree(sections: any[]): string {
        if (!sections || sections.length === 0) {
            return 'No sections available.';
        }

        const lines: string[] = [];

        for (const section of sections) {
            // Add section with tree branch symbol
            lines.push(`${lines.length === 0 ? '┌─' : '├─'} ${section.name}`);
            lines.push(`│  ${section.description}`);

            // Add categories under this section
            if (section.categories && section.categories.length > 0) {
                for (let i = 0; i < section.categories.length; i++) {
                    const category = section.categories[i];
                    const isLast = i === section.categories.length - 1;
                    const prefix = isLast ? '│  └─' : '│  ├─';
                    lines.push(`${prefix} ${category.name}`);
                    if (category.description && category.description !== category.name) {
                        lines.push(`│     ${category.description}`);
                    }
                }
            } else {
                lines.push('│  └─ No categories');
            }

            // Add spacing between sections
            if (sections.indexOf(section) < sections.length - 1) {
                lines.push('│');
            }
        }

        return lines.join('\n');
    }
    
    /**
     * Pull a model from Ollama (only works for local mode)
     */
    protected async pullModel(modelName: string): Promise<boolean> {
        const mode = await getCurrentMode();
        if (mode !== 'local') {
            console.warn(`[Agent:${this.name}] Cannot pull model in remote mode`);
            return false;
        }

        const ollama = (await getService('local', modelName)) as any;
        return ollama.pullModel?.(modelName) ?? false;
    }

    /**
     * Optional: append assistant response to state.messages
     */
    protected async appendResponse(state: BaseThreadState, content: string): Promise<void> {
        // Ensure content is a string
        const contentStr = typeof content === 'string' ? content : JSON.stringify(content);

        if (this.currentNodeRunContext) {
            this.currentNodeRunContext.messages.push({
                role: 'assistant',
                content: contentStr,
                metadata: {
                    nodeId: this.id,
                    timestamp: Date.now()
                }
            });
        }

        this.appendNodeScopedMessage(state, {
            role: 'assistant',
            content: contentStr,
            metadata: {
                nodeId: this.id,
                timestamp: Date.now()
            }
        }, 'assistant');

        if (this.currentNodeRunContext && !this.currentNodeRunContext.policy.persistAssistantToGraph) {
            return;
        }
        
        state.messages.push({
            role: 'assistant',
            content: contentStr,
            metadata: {
                nodeId: this.id,
                timestamp: Date.now()
            }
        });
        this.bumpStateVersion(state);
    }

    /**
     * Connect to a WebSocket server and optionally register a message handler
     * @param connectionId Unique identifier for this connection
     * @param url WebSocket URL (defaults to ws://localhost:8080/)
     * @param onMessage Optional handler for incoming messages
     * @returns true if connection initiated
     */
    protected connectWebSocket(
        connectionId: string,
        onMessage?: WebSocketMessageHandler
    ): boolean {
        const wsService = getWebSocketClientService();
        const connected = wsService.connect(connectionId);

        if (connected && onMessage) {
            // Small delay to allow connection to establish before registering handler
            setTimeout(() => {
                wsService.onMessage(connectionId, onMessage);
            }, 100);
        }

        return connected;
    }

    /**
     * Send a message to a WebSocket connection
     * @param connectionId Connection identifier
     * @param message Message to send (object or string)
     * @returns true if sent successfully
     */
    protected async dispatchToWebSocket(connectionId: string, message: unknown): Promise<boolean> {
        const wsService = getWebSocketClientService();
        return await wsService.send(connectionId, message);
    }

    /**
     * Register a handler for WebSocket messages
     * @param connectionId Connection identifier
     * @param handler Callback function for incoming messages
     * @returns Unsubscribe function or null if connection not found
     */
    protected listenToWebSocket(
        connectionId: string,
        handler: WebSocketMessageHandler,
    ): (() => void) | null {
        const wsService = getWebSocketClientService();
        return wsService.onMessage(connectionId, handler);
    }

    /**
     * Disconnect from a WebSocket server
     * @param connectionId Connection identifier
     */
    protected disconnectWebSocket(connectionId: string): void {
        const wsService = getWebSocketClientService();
        wsService.disconnect(connectionId);
    }

    /**
     * Check if a WebSocket connection is active
     * @param connectionId Connection identifier
     */
    protected isWebSocketConnected(connectionId: string): boolean {
        const wsService = getWebSocketClientService();
        return wsService.isConnected(connectionId);
    }


    /**
     * Dispatch token information to AgentPersona via WebSocket
     */
    private async dispatchTokenInfoToAgentPersona(state: BaseThreadState, reply: NormalizedResponse): Promise<void> {
        const wsChannel = state.metadata.wsChannel || DEFAULT_WS_CHANNEL;
        const sent = await this.dispatchToWebSocket(wsChannel, {
            type: 'token_info',
            data: {
                tokens_used: reply.metadata.tokens_used,
                prompt_tokens: reply.metadata.prompt_tokens,
                completion_tokens: reply.metadata.completion_tokens,
                time_spent: reply.metadata.time_spent,
                threadId: state.metadata.threadId,
                nodeId: this.name,
            },
            timestamp: Date.now(),
        });

        if (!sent) {
            console.warn(`[BaseNode:${this.name}] Failed to send token info via WebSocket`);
        }
    }

    /**
     * Emit a chat message to the UI dashboard via WebSocket
     * Connection ID is read from state.metadata.wsChannel (defaults to 'chat-controller')
     * @param state BaseThreadState containing the connection ID in metadata
     * @param content Message content to display
     * @param role 'assistant' | 'system' - defaults to 'assistant'
     * @param kind Optional UI kind tag - defaults to 'progress'
     * @returns true if message was sent via WebSocket
     */
    protected async wsChatMessage(
        state: BaseThreadState,
        content: string,
        role: 'assistant' | 'system' = 'assistant',
        kind: string = 'progress',
    ): Promise<boolean> {
        if (!content.trim()) {
            return false;
        }

        // Get connection ID from state or use default
        const connectionId = (state.metadata.wsChannel as string) || DEFAULT_WS_CHANNEL;

        // Ensure WebSocket connection exists
        if (!this.isWebSocketConnected(connectionId)) {
            console.log(`[${this.name}:BaseNode] Not Connected`)
            this.connectWebSocket(connectionId);
        }

        // Send via WebSocket
        const sent = await this.dispatchToWebSocket(connectionId, {
            type: 'assistant_message',
            data: {
                content: content.trim(),
                role,
                kind,
                timestamp: Date.now(),
            },
        });

        if (!sent) {
            console.warn(`[Agent:${this.name}] Failed to send chat message via WebSocket`);
        } else {
            state.metadata.hadUserMessages = true;
        }

        return sent;
    }

    /**
     * Emit a tool call event to create/update tool cards in the UI
     * @param state BaseThreadState containing the WebSocket channel
     * @param toolRunId Unique identifier for this tool execution
     * @param toolName Name of the tool being called
     * @param args Arguments passed to the tool
     * @param kind Optional kind of the event (e.g., 'thinking', 'info')
     * @returns true if event was sent via WebSocket
     */
    protected async emitToolCallEvent(
        state: BaseThreadState,
        toolRunId: string,
        toolName: string,
        args: Record<string, any>,
        kind?: string
    ): Promise<boolean> {
        const connectionId = (state.metadata.wsChannel as string) || DEFAULT_WS_CHANNEL;
        
        return await this.dispatchToWebSocket(connectionId, {
            type: 'progress',
            data: {
                phase: 'tool_call',
                toolRunId,
                toolName,
                args,
                kind
            },
            timestamp: Date.now()
        });
    }

    /**
     * Emit a tool result event to update tool card status in the UI
     * @param state BaseThreadState containing the WebSocket channel
     * @param toolRunId Same ID from the tool_call event
     * @param success Whether the tool execution succeeded
     * @param error Optional error message if success is false
     * @param result Optional result data if success is true
     * @returns true if event was sent via WebSocket
     */
    protected async emitToolResultEvent(
        state: BaseThreadState,
        toolRunId: string,
        success: boolean,
        error?: string,
        result?: any
    ): Promise<boolean> {
        const connectionId = (state.metadata.wsChannel as string) || DEFAULT_WS_CHANNEL;
        
        return await this.dispatchToWebSocket(connectionId, {
            type: 'progress',
            data: {
                phase: 'tool_result',
                toolRunId,
                success,
                error,
                result
            },
            timestamp: Date.now()
        });
    }

    private stableStringify(value: unknown): string {
        const normalize = (input: unknown): unknown => {
            if (Array.isArray(input)) {
                return input.map(item => normalize(item));
            }

            if (!input || typeof input !== 'object') {
                return input;
            }

            const record = input as Record<string, unknown>;
            const sortedKeys = Object.keys(record).sort((a, b) => a.localeCompare(b));
            const normalized: Record<string, unknown> = {};
            for (const key of sortedKeys) {
                normalized[key] = normalize(record[key]);
            }

            return normalized;
        };

        return JSON.stringify(normalize(value));
    }

    private buildToolRunDedupeKey(toolName: string, args: unknown): string {
        return `${toolName}:${this.stableStringify(args ?? {})}`;
    }

    private persistStructuredToolRunRecord(
        state: BaseThreadState,
        payload: {
            toolName: string;
            toolRunId: string;
            args: unknown;
            success: boolean;
            result?: unknown;
            error?: string;
        },
    ): void {
        if (!this.currentNodeRunContext) {
            return;
        }

        const metadataAny = state.metadata as any;
        const dedupeKey = this.buildToolRunDedupeKey(payload.toolName, payload.args);
        const record = {
            toolName: payload.toolName,
            toolRunId: payload.toolRunId,
            dedupeKey,
            args: payload.args ?? {},
            success: payload.success,
            result: payload.result,
            error: payload.error,
            timestamp: Date.now(),
            nodeId: this.id,
            nodeName: this.name,
        };

        if (!Array.isArray(metadataAny.__toolRuns)) {
            metadataAny.__toolRuns = [];
        }
        if (!metadataAny.__toolRunIndex || typeof metadataAny.__toolRunIndex !== 'object') {
            metadataAny.__toolRunIndex = {};
        }
        metadataAny.__toolRuns.push(record);
        metadataAny.__toolRunIndex[dedupeKey] = record;

        const namespace = String(this.currentNodeRunContext.policy.nodeStateNamespace || '').trim();
        if (namespace) {
            this.ensureNodeMessageLaneInitializedFromGraph(state, namespace);

            if (!Array.isArray(metadataAny[namespace].toolRuns)) {
                metadataAny[namespace].toolRuns = [];
            }

            if (!metadataAny[namespace].toolRunIndex || typeof metadataAny[namespace].toolRunIndex !== 'object') {
                metadataAny[namespace].toolRunIndex = {};
            }

            metadataAny[namespace].toolRuns.push(record);
            metadataAny[namespace].toolRunIndex[dedupeKey] = record;
        }
        this.bumpStateVersion(state);
    }


    /**
     * Execute multiple tool calls, append results as 'tool' messages, return results array.
     * - Appends each result immediately after execution (LLM sees sequential feedback)
     * - Uses role: 'tool' + name/tool_call_id for API compatibility
     * - Failed tools include help info
     * - Minimal logging (no full JSON dump)
     */
    protected async executeToolCalls(
        state: BaseThreadState,
        toolCalls: Array<{name: string, id?: string, args: any}>,
        allowedTools?: string[]
    ): Promise<Array<{ toolName: string; success: boolean; result?: unknown; error?: string }>> {
        if (!toolCalls?.length) return [];

        state.metadata.hadToolCalls = true;
        if (this.currentNodeRunContext) {
            this.currentNodeRunContext.hadToolCalls = true;
        }

        // Check for abort before processing tools
        throwIfAborted(state, 'Tool execution aborted');

        const results: Array<{ toolName: string; success: boolean; result?: unknown; error?: string }> = [];

        for (const call of toolCalls) {
            // Check for abort before each tool execution
            throwIfAborted(state, `Tool execution aborted before ${call.name}`);
            
            // Use call.id or generate unique tool run ID for this execution
            const toolRunId = call.id || `${call.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const toolName = call.name;
            const args = call.args;

            const policyBlockReason = await this.getToolPolicyBlockReason(state, toolName);
            if (policyBlockReason) {
                await this.emitToolCallEvent(state, toolRunId, toolName, args);
                await this.emitToolResultEvent(state, toolRunId, false, policyBlockReason);

                await this.appendToolResultMessage(state, toolName, {
                    toolName,
                    success: false,
                    error: policyBlockReason,
                    toolCallId: toolRunId
                });
                this.persistStructuredToolRunRecord(state, {
                    toolName,
                    toolRunId,
                    args,
                    success: false,
                    error: policyBlockReason,
                });
                results.push({ toolName, success: false, error: policyBlockReason });
                if (this.currentNodeRunContext) {
                    this.currentNodeRunContext.toolTranscript.push({
                        toolName,
                        success: false,
                        error: policyBlockReason,
                    });
                }
                continue;
            }

            // Disallowed → emit tool call and failure, then continue
            if (allowedTools?.length && !allowedTools.includes(toolName)) {
                await this.emitToolCallEvent(state, toolRunId, toolName, args);
                await this.emitToolResultEvent(state, toolRunId, false, `Tool not allowed in this node: ${toolName}`);
                
                await this.appendToolResultMessage(state, toolName, {
                    toolName,
                    success: false,
                    error: `Tool not allowed in this node: ${toolName}`,
                    toolCallId: toolRunId
                });
                this.persistStructuredToolRunRecord(state, {
                    toolName,
                    toolRunId,
                    args,
                    success: false,
                    error: `Tool not allowed in this node: ${toolName}`,
                });
                results.push({ toolName, success: false, error: 'Not allowed' });
                if (this.currentNodeRunContext) {
                    this.currentNodeRunContext.toolTranscript.push({
                        toolName,
                        success: false,
                        error: `Tool not allowed in this node: ${toolName}`,
                    });
                }
                continue;
            }

            try {
                const tool = await toolRegistry.getTool(toolName);
                
                // Emit tool call event before execution
                await this.emitToolCallEvent(state, toolRunId, toolName, args);

                try {
                    // Inject WebSocket capabilities into the tool
                    if (tool instanceof BaseTool) {
                        tool.setState(state);

                        tool.sendChatMessage = (content: string, kind = "progress") => 
                        this.wsChatMessage(state, content, "assistant", kind);
                        
                        tool.emitProgress = async (data: any) => {
                            await this.dispatchToWebSocket(state.metadata.wsChannel || DEFAULT_WS_CHANNEL, {
                                type: "progress_update",
                                data: { ...data, kind: 'progress' },
                                timestamp: Date.now()
                            });
                        };
                    }

                    const result = await tool.invoke(args);
                    const toolSuccess = result?.success === true;
                    const toolError = typeof result?.error === 'string'
                        ? result.error
                        : (!toolSuccess && typeof result?.result === 'string' ? result.result : undefined);

                    await this.emitToolResultEvent(state, toolRunId, toolSuccess, toolError, result);

                    await this.appendToolResultMessage(state, toolName, {
                        toolName,
                        success: toolSuccess,
                        result,
                        error: toolError,
                        toolCallId: toolRunId
                    });
                    this.persistStructuredToolRunRecord(state, {
                        toolName,
                        toolRunId,
                        args,
                        success: toolSuccess,
                        result,
                        error: toolError,
                    });

                    results.push({
                        toolName,
                        success: toolSuccess,
                        result,
                        error: toolError
                    });
                    if (this.currentNodeRunContext) {
                        this.currentNodeRunContext.toolTranscript.push({
                            toolName,
                            success: toolSuccess,
                            result,
                            error: toolError,
                        });
                    }
                } catch (err: any) {
                    const error = err.message || String(err);
                    
                    // Emit tool result event on error
                    await this.emitToolResultEvent(state, toolRunId, false, error);
                    
                    await this.appendToolResultMessage(state, toolName, {
                        toolName,
                        success: false,
                        error,
                        toolCallId: toolRunId
                    });
                    this.persistStructuredToolRunRecord(state, {
                        toolName,
                        toolRunId,
                        args,
                        success: false,
                        error,
                    });
                    results.push({ toolName, success: false, error });
                    if (this.currentNodeRunContext) {
                        this.currentNodeRunContext.toolTranscript.push({
                            toolName,
                            success: false,
                            error,
                        });
                    }
                }
            } catch {
                await this.emitToolCallEvent(state, toolRunId, toolName, args);
                await this.emitToolResultEvent(state, toolRunId, false, `Unknown tool: ${toolName}`);
                
                await this.appendToolResultMessage(state, toolName, {
                    toolName,
                    success: false,
                    error: `Unknown tool: ${toolName}`,
                    toolCallId: toolRunId
                });
                this.persistStructuredToolRunRecord(state, {
                    toolName,
                    toolRunId,
                    args,
                    success: false,
                    error: `Unknown tool: ${toolName}`,
                });
                results.push({ toolName, success: false, error: 'Unknown tool' });
                if (this.currentNodeRunContext) {
                    this.currentNodeRunContext.toolTranscript.push({
                        toolName,
                        success: false,
                        error: 'Unknown tool',
                    });
                }
                continue;
            }
        }

        return results;
    }

    private async getToolPolicyBlockReason(state: BaseThreadState, toolName: string): Promise<string | null> {
        const policy = (state.metadata as any).__toolAccessPolicy as {
            allowedCategories: string[] | null;
            allowedToolNames: string[] | null;
        } | undefined;

        if (!policy) {
            return null;
        }

        const allowedToolNames = policy.allowedToolNames;
        if (allowedToolNames?.length && !allowedToolNames.includes(toolName)) {
            return `Tool not allowed by name policy: ${toolName}`;
        }

        let toolInstance: any;
        try {
            toolInstance = await toolRegistry.getTool(toolName);
        } catch {
            return null;
        }

        const category = String(toolInstance?.metadata?.category || '').trim();
        const allowedCategories = policy.allowedCategories;
        if (allowedCategories?.length && !allowedCategories.includes(category)) {
            return `Tool category not allowed in this node: ${toolName} (category: ${category || 'unknown'})`;
        }

        return null;
    }

    /**
     * Append tool result as a 'tool' message to state.messages.
     * Role: 'tool' — standard for most LLM APIs (OpenAI, Anthropic, Grok).
     * Includes short summary + full JSON payload for context.
     * Failed tools add help instructions.
     */
    public async appendToolResultMessage(
        state: BaseThreadState,
        action: string,
        result: ToolResult
    ): Promise<void> {
        // Skip appending tool results for tools that should not add message payloads.
        if (action === 'emit_chat_message' || action === 'browse_tools') {
            return;
        }

        const summary = result.success
            ? `Tool ${action} succeeded`
            : `Tool ${action} failed: ${result.error || 'unknown error'}`;

        const normalizeResultPayload = (payload: unknown): unknown => {
            if (typeof payload !== 'string') {
                return payload;
            }

            const trimmed = payload.trim();
            if (!trimmed) {
                return payload;
            }

            if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
                return payload;
            }

            try {
                return JSON.parse(trimmed);
            } catch {
                return payload;
            }
        };

        const unwrapToolEnvelope = (payload: unknown): unknown => {
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                return payload;
            }

            const record = payload as Record<string, any>;
            if ('result' in record && (
                'toolName' in record ||
                'tool' in record ||
                'success' in record ||
                'toolCallId' in record
            )) {
                return record.result;
            }

            return payload;
        };

        const formatForMessage = (payload: unknown): string => {
            if (payload == null) {
                return 'null';
            }

            const serialized = typeof payload === 'string'
                ? payload
                : JSON.stringify(payload, null, 2);

            if (serialized.length <= 5000) {
                return serialized;
            }

            return `${serialized.substring(0, 5000)}...`;
        };

        const normalizedResult = normalizeResultPayload(result.result);
        const compactResult = unwrapToolEnvelope(normalizedResult);
        const detailText = compactResult == null ? '' : formatForMessage(compactResult);
        const normalizedErrorText = String(result.error || 'unknown error').trim();
        const normalizedDetailText = detailText.trim();
        const includeDetails = normalizedDetailText.length > 0 && normalizedDetailText !== normalizedErrorText;

        const content = result.success
            ? [
                `tool: ${action}`,
                'result:',
                formatForMessage(compactResult),
            ].join('\n')
            : [
                `tool: ${action}`,
                `error: ${normalizedErrorText || 'unknown error'}`,
                includeDetails ? `result:\n${detailText}` : '',
            ].filter(Boolean).join('\n');

        const toolMessage: ChatMessage = {
            role: 'tool',
            content,
            name: action,                     // tool name as sender
            tool_call_id: result.toolCallId,  // link back to call
            metadata: {
                nodeId: this.id,
                nodeName: this.name,
                kind: 'tool_result',
                toolName: action,
                success: result.success,
                summary,
                timestamp: Date.now()
            }
        };

        if (this.currentNodeRunContext) {
            this.currentNodeRunContext.messages.push(toolMessage);
        }

        this.appendNodeScopedMessage(state, toolMessage, 'tool');

        if (this.currentNodeRunContext && !this.currentNodeRunContext.policy.persistToolResultsToGraph) {
            return;
        }

        state.messages.push(toolMessage);
        this.bumpStateVersion(state);
    }

    /**
     * Execute a single tool call using the standard executeToolCalls method
     * This provides consistent reporting and success/failure feedback
     */
    protected async executeSingleTool(state: any, toolCall: any[]): Promise<void> {
        // Normalize exec-form array to normalized object
        const name = toolCall[0];
        const execArgs = toolCall.slice(1);
        // For now, assume single arg tools like emit_chat_message where args[0] is the content
        const args = execArgs.length === 1 ? { content: execArgs[0] } : execArgs;
        const normalized = { name, args };
        await this.executeToolCalls(state, [normalized]);
    }
}