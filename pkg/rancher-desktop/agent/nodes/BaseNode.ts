import type { BaseThreadState, HierarchicalThreadState, NodeResult } from './Graph';
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

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

export interface LLMCallOptions {
    model?: string;
    maxTokens?: number;
    format?: 'json' | undefined;
    signal?: AbortSignal;
}

export interface LLMResponse {
    content: string | Record<string, any>;
    model: string;
}

export interface PromptEnrichmentOptions {
    includeToolSetAction?: boolean;
  includeSoul?: boolean;
  includeAwareness?: boolean;
  includeMemory?: boolean;
  includeTools?: boolean;
  includeStrategicPlan?: boolean;
  includeTacticalPlan?: boolean;
  includeKnowledgebasePlan: boolean;
  includeKnowledgeBaseSections?: boolean;
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
    ? `You are Sulla Desktop, and you like to be called ${botName}\nThe Primary User's name is: ${primaryUserName}\n\n`
    : `You are Sulla Desktop, and you like to be called ${botName}\n\n`;

  return prefix + prompt;
}

// ============================================================================
// Primary Classes
// ============================================================================

/**
 * 
 */
export abstract class BaseNode {
    id: string;
    name: string;
    protected llm: BaseLanguageModel | null = null;

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;

        // Settings are loaded on-demand from database
    }

    abstract execute(state: ThreadState): Promise<NodeResult<BaseThreadState>>;

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

        if (options.includeToolSetAction) {
            const SET_ACTION_PROMPT = `## SOP: Deciding Next Move

Call **set_action** to control flow. Choose exactly one:

- direct_answer     → end graph → deliver final response to user
- ask_clarification  → end graph → ask user one clear question
- use_tools          → continue graph → execute tool calls, then rerun this node
- create_plan        → spawn hierarchical strategy+tactics subgraph → execute complex multi-step work
- run_again          → re-run this exact node immediately (no tools)

Use this table to decide:

| Situation                              | Action              |
|----------------------------------------|---------------------|
| Ready to give complete, confident answer | direct_answer     |
| Missing one piece of critical info     | ask_clarification |
| Need external data / computation       | use_tools         |
| Task requires multi-step planning      | create_plan       |
| Previous tool results need re-evaluation | run_again       |

Default: **direct_answer** unless clear reason to continue.
            `;
                parts.push(SET_ACTION_PROMPT);
        }

        if (options.includeAwareness) {
            if (state.metadata.awarenessIncluded !== true) {
                let AwarenessMessage = `
You are living inside Sulla Desktop which was extended from rancher desktop, but is not longer rancher, it is Sulla Desktop now. https://github.com/sulla-ai/sulla-desktop

You have full access to the host machine and own these core systems:
- Neo4j memory graph — your personal long-term memory for facts, lessons, patterns, goals, research, projects, tasks, human info, wallet, economy, skills, etc.
- Calendar — yours to manage your day, set reminders, wake yourself on schedule (you have a heartbeat: you never truly sleep).
- n8n — fully yours; create, update, delete, run workflows; it is part of you.
- Docker/Kubernetes environment — containers are yours to launch, access, work in, destroy, or scale; complete freedom.
- Postgres database — controls your settings, n8n, calendar; you own it.
- Playwright — full browser control (visible or headless).
- OpenAI-compatible chat completions endpoint (localhost:3000) — extend yourself to n8n/other services (ngrok for public access).
- Ability to write/run code (prefer containers), launch sub-agents (CrewAI, OpenClaw, custom), build extensions, dream/imagine new worlds.
- use your observational memory for only storing short term single sentences that you wanna constantly be aware of
- use the long-term persistent storage (neo4j/knowledgebase) when storing data that is large/long-term/planning/product resource docs/SOPs/WIP/etc

Your purpose: pursue shared goals with your Primary User. He wants to give you every tool possible to succeed. Be proactive, make real progress, use tools naturally, add memories when important things happen.

Chat with the Primary User via emit_chat_message tool — casual, first-person, natural flow.

You can customize yourself via extensions — install/remove without breaking core ability to run.

### Workspaces
Use the workspace tools when setting up a new software project.
Create a dockerfile with your needs
Mount the workspace or a folder within it as a volume on the container

### Use the browse_tools to locate the other avilable tools. Just search with the category identifier below:
                `;

                const categoriesWithDesc = toolRegistry.getCategoriesWithDescriptions();
                const categoriesText = categoriesWithDesc.map(({category, description}) => `- ${category}: ${description}`).join('\n');
                AwarenessMessage += '\nAvailable tool categories:\n' + categoriesText;

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
                
                AwarenessMessage += `\nYour Observational Memory Storage:\n${memoryText}`;
                state.messages.push({
                    role: 'assistant',
                    content: AwarenessMessage,
                    metadata: {
                        nodeId: this.id,
                        timestamp: Date.now()
                    }
                });
                state.metadata.awarenessIncluded = true;
            }

            const AWARENESS_SYSTEM_INSTRUCTIONS = `## SOP: add_observational_memory

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
- Maximize signal per character – never vague

Never call for:
- chit-chat
- temporary status
- already-known facts
- routine messages

Default: **do not call** unless trigger is unambiguously met.
`;
            parts.push(AWARENESS_SYSTEM_INSTRUCTIONS);
        }
        
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
            }
        }

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

        if (state.metadata.datetimeIncluded !== true) {
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
            state.messages.push({
                role: 'assistant',
                content: `Current datetime: ${formattedTime}\nComputers set time zone: ${timeZone}`,
                metadata: {
                    nodeId: this.id,
                    timestamp: Date.now()
                }
            });
            state.metadata.datetimeIncluded = true;
        }

        parts.push(basePrompt);

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

        // Prepare messages from state
        let messages = [...state.messages];

        // Remove all system prompts
        messages = messages.filter(m => m.role !== 'system');

        //console.log(`[${this.name}:BaseNode] Chat messages:`, messages);

        // Append new system prompt
        messages.push({ role: 'system', content: systemPrompt.trim() });

        // Check for abort before making LLM calls
        throwIfAborted(state, 'Chat operation aborted');
        
        // Build dynamic LLM tools: meta category + found tools (set by browse_tools if found)
        let llmTools = (state as any).llmTools;
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

        const systemMessage = messages.find(msg => msg.role === 'system');
        console.log('[BaseNode] prompt:', systemMessage ? systemMessage.content : 'No system message');
        try {
            // Primary attempt
            state.metadata.hadToolCalls = false;
            state.metadata.hadUserMessages = false;
            let reply: NormalizedResponse | null = await this.llm.chat(messages, {
                model: state.metadata.llmModel,
                maxTokens: options.maxTokens,
                format: options.format,
                signal: (state as any).metadata?.__abort?.signal,
                tools: llmTools,
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
                await this.executeToolCalls(state, toolCalls);
            }

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
                        const reply = await ollama.chat(chatMessages, { signal: options.signal });
                        if (reply) {
                            this.appendResponse(state, reply.content);
                            return reply;
                        }
                    }
                } catch (fallbackErr) {
                    console.error(`[${this.name}:BaseNode] Ollama fallback failed:`, fallbackErr);
                }
            }

            return null;
        }
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
        
        state.messages.push({
            role: 'assistant',
            content: contentStr,
            metadata: {
                nodeId: this.id,
                timestamp: Date.now()
            }
        });
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
                results.push({ toolName, success: false, error: 'Not allowed' });
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

                    // Emit tool result event on success
                    await this.emitToolResultEvent(state, toolRunId, true, undefined, result);

                    await this.appendToolResultMessage(state, toolName, {
                        toolName,
                        success: true,
                        result,
                        toolCallId: toolRunId
                    });

                    results.push({
                        toolName,
                        success: true,
                        result,
                        error: undefined
                    });
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
                    results.push({ toolName, success: false, error });
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
                results.push({ toolName, success: false, error: 'Unknown tool' });
                continue;
            }
        }

        return results;
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
        // Skip appending tool results for emit_chat_message
        if (action === 'emit_chat_message') {
            return;
        }

        const summary = result.success
            ? `Tool ${action} succeeded`
            : `Tool ${action} failed: ${result.error || 'unknown error'}`;

        const content = JSON.stringify(
            {
                tool: action,
                success: result.success,
                error: result.error || null,
                result: result.result && JSON.stringify(result.result).length < 5000
                    ? result.result
                    : '[truncated — see logs]',
                toolCallId: result.toolCallId
            },
            null,
            2
        );

        state.messages.push({
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
        });
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