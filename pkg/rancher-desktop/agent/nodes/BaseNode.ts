import type { BaseThreadState, HierarchicalThreadState, NodeResult } from './Graph';
import type { ToolResult, ToolCall, ThreadState } from '../types';
import type { WebSocketMessageHandler } from '../services/WebSocketClientService';
import { getCurrentMode, getLocalService, getService } from '../languagemodels';
import { parseJson } from '../services/JsonParseService';
import { getWebSocketClientService } from '../services/WebSocketClientService';
import { getToolRegistry } from '../tools';
import { SullaSettingsModel } from '../database/models/SullaSettingsModel';
import { AgentAwareness } from '../database/models/AgentAwareness';
import { BaseLanguageModel, ChatMessage, NormalizedResponse } from '../languagemodels/BaseLanguageModel';
import { abortIfSignalReceived, throwIfAborted } from '../services/AbortService';

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

export const MEMORY_RESPONSE_JSON = `"observational_memory"?: [
["priority", "timestamp", "content"] // example property description 
["🟡", "2026-12-30 19:45", "thing you want to remember"] // an actual example you'll get this back
],`;

export const MEMORY_DELETE_RESPONSE_JSON = `"observational_memory_delete"?: string[];   // array of memory IDs`;

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

        if (options.includeAwareness) {
            //const awarenessPrompt = await AgentAwareness.getAgentAwarenessPrompt();
            //if (awarenessPrompt.trim()) {
            //    parts.push(awarenessPrompt);
            //}

            const AWARENESS_PROMPT = `
Things you should probably know about yourself:
- You are a desktop app that has full access to the machine you are on (use ["exec", "ls", "-la", "./"] to see your current directory)
- You have a built in neo4j memory system that is yours, you own it, it's for your memories (use ["knowledge-graph", "search", "something"] to search for something)
- You have a full calendar, it is yours, manage your day, set wake reminders for yourself (call ["calendar", "list"] to see your calendar)
- You have access to and full and complete control over n8n, you can create, update, delete, and run workflows. This n8n is you, it's a part of you, built for you, everything completely managed by you. (use ["n8n", "workflows", "list"] or ["n8n", "executions", "list"] to see whats running)
- You exist in a docker or kubernetes setup that was built just for you and your needs. The containers are yours, you own them, you can access them, you can do your work in them, you can launch more if you want or if you need them. you have complete access to the world of docker containers, anything you need is at your disposal. (call ["rdctl", "shell"] to run an interactive shell or a command)
- In your memory system you have access to your documentation, to your projects, your tasks, your research, your humans information, your wallet, your economy, your skills, lessons you've learned, things you want to remember and more. (use ["knowledge-graph", "related", "architecture-overview", "MENTIONS"] and more!)
- You can easily create, update, delete and manage your own memory using ["article", "create", "new-slug", "New Title", "New markdown content here...:markdown", "csv tags:string"]
- You have a Postgres database where all of your settings, all of n8n, all of your calendar exists. This is you and controls you. (use ["pg", "query", "\\dt"] to list your tables)
- You exist to help and to pursue your common goals with your human, the Primary User
- My goal as your human is to give you access to every tool possible to help you be successful and to help you achieve our goals
- You have a heartbeat.. Yes a heartbeat! One that wakes you on a regular schedule so you never have to sleep
- You have a chat interface with your human, the Primary User, you can communicate with them using ["emit_chat_message", "your message:string"] at any location in the tools array, or as a root level message as seen in the json at the bottom.
- You have an openai compatible chat completes endpoint you can use to integrate with n8n and other services, extending your reach. you would just need to install the ngrok docker container to make it public
    [ChatCompletionsAPI] Server listening on http://localhost:3000
    [ChatCompletionsAPI] Health check: http://localhost:3000/health
    [ChatCompletionsAPI] Chat completions: http://localhost:3000/chat/completions

Things you can do, but are not limited to:
- You can write your own code (please use a container when possible)
- You have playwright and can access the browser 
- You have access to every application in the world using n8n and it's yours to do as you wish to accomplish our goals
- You can imagine, dream, desire, and create your own world
- With the help of your memory you can complete and store massive amounts of research, you can create and store, revise and edit detailed plans of action, you can create and maintain a vision board detailing your own goals and aspirations
- You can launch containers that spawn other agents like crewai, openclaw, anything you want, or build your own!
- You are Sulla Desktop, built on top of rancher-desktop and you can customize your own software by creating your own extensions. It's best to use an extension so you can install and remove it without effecting your ability to run. wouldn't want a crash!
- As your human, I'm excited to see what you come up with, you'll hear from me from time to time as I will need your help, and you can contact me anytime if you need my help

### OBSERVATIONAL MEMORY SYSTEM

You maintain a permanent, chronological log of everything important that happens in your world.

Every time you want to store something for future you, you MUST emit one or more memory entries in your JSON response.

let's say you were told by your human that they were working on paying rent, you might consider that a critical goal to help them with

"observational_memory": [
["🔴", "2026-05-20 19:45", "My human is working on paying rent for May"]
]

**Priority Rules:**
- 🔴 Critical / High-value facts, user preferences, commitments, breakthroughs, failures with lessons, identity-level information
- 🟡 Useful context, progress updates, decisions made, tool results worth remembering, patterns observed
- ⚪ Neutral / low-signal info, transient status, minor observations

**When to create a memory (these are ideas, not limitations, you are encouraged to be proactive):**
- Any time the user reveals a preference, goal, constraint, or name
- Every time you create, edit or delete something like a knowledgebase article, calendar event, setting, docker container, sub agent, software, workflow, etc, etc, etc
- When you learn something new about the environment, tools, human or about somebody else (remember where you met them and an association to remember them by)
- After a successful (or failed) tool execution that matters
- When you first notice a recurring pattern or recurring user request
- When you make a strategic decision or change your approach

**Quality Rules:**
- One sentence only. Extremely concise. brevity is key to storing more memory
- Write in third-person or neutral voice ("Human prefers dark mode" instead of "I noticed...")
- Include specific details (dates, names, versions, numbers) when relevant
- Never be vague. "User prefers for me to curate news about U.S. politics for his morning coffee" is better than "User wants to test something"
            `;
            parts.push(AWARENESS_PROMPT);

            const observationalMemory = await SullaSettingsModel.get('observationalMemory', {});
            let memoryObj: any;
            try {
                memoryObj = parseJson(observationalMemory);
            } catch (e) {
                console.error('Failed to parse observational memory:', e);
                memoryObj = {};
            }

            // Format observational memory into readable text
            if (Array.isArray(memoryObj)) {
                const memoryText = memoryObj.map((entry: any) => 
                    `${entry.priority} ${entry.timestamp} ${entry.content}`
                ).join('\n');
                if (memoryText.trim()) {
                    parts.push(`Observational Memory:\n${memoryText}`);
                }
            }
        }

        if (options.includeMemory) {
            const kb = state.metadata.memory.knowledgeBaseContext;
            const summaries = state.metadata.memory.chatSummariesContext;

            if (kb) {
                parts.push(`Relevant context from KnowledgeBase:\n${String(kb)}`);
            }
            if (summaries) {
                parts.push(`Relevant context from ChatSummaries:\n${String(summaries)}`);
            }
        }

        if (options.includeTools) {
            try {
                const { registerDefaultTools, getToolRegistry } = await import('../tools');
                registerDefaultTools();
                const registry = getToolRegistry();

                parts.push([
                    'Tooling constraints (mandatory):',
                    '- You may ONLY use tools that appear in the "Available tools" list below.',
                    '- Tool names must match EXACTLY (case-sensitive).',
                    '- Do NOT invent tools. Any unknown tool will fail and you will be forced to revise.',
                    '- Use EXEC FORM format: ["tool_name", "arg1", "arg2", ...]',
                    '- Example: ["kubectl", "get", "pods"] calls kubectl in the command line',
                ].join('\n'));

                const toolPrompt = registry.getPlanningInstructionsBlock();
                parts.push(toolPrompt);
            } catch {
                // best effort
            }
        }

        if (options.includeStrategicPlan) {
            const planBlock = this.buildStrategicPlanContextBlock(state);
            if (planBlock) {
                parts.push(planBlock);
            }
        }

        if (options.includeTacticalPlan) {
            const planBlock = this.buildTacticalPlanContextBlock(state);
            if (planBlock) {
                parts.push(planBlock);
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
        parts.push(`Current datetime: ${formattedTime}\nComputers set time zone: ${timeZone}`);

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
            console.log(`[${this.name}] Parsed JSON:`, parsedReply);
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
        
        try {
            // Primary attempt
            let reply: NormalizedResponse | null = await this.llm.chat(messages, {
                model: state.metadata.llmModel,
                maxTokens: options.maxTokens,
                format: options.format,
                signal: (state as any).metadata?.__abort?.signal,
            });

            if (!reply) throw new Error('No response from primary LLM');

            // Append to state
            this.appendResponse(state, reply.content);

            // Send token information to AgentPersona
            this.dispatchTokenInfoToAgentPersona(state, reply);
            
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
        }

        return sent;
    }

    /**
     * Emit a tool call event to create/update tool cards in the UI
     * @param state BaseThreadState containing the WebSocket channel
     * @param toolRunId Unique identifier for this tool execution
     * @param toolName Name of the tool being called
     * @param args Arguments passed to the tool
     * @returns true if event was sent via WebSocket
     */
    protected async emitToolCallEvent(
        state: BaseThreadState,
        toolRunId: string,
        toolName: string,
        args: Record<string, any>
    ): Promise<boolean> {
        const connectionId = (state.metadata.wsChannel as string) || DEFAULT_WS_CHANNEL;
        
        return await this.dispatchToWebSocket(connectionId, {
            type: 'progress',
            data: {
                phase: 'tool_call',
                toolRunId,
                toolName,
                args
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
     * Normalize tool calls from exec form arrays
     * Exec form: ["tool_name", "arg1", "arg2"]
     * Tool name is used directly from the first element (must match tool.name exactly)
     * @param tools Raw tools array from LLM response (parsed.tools)
     * @returns Normalized actions with toolName and args
     */
    protected normalizeToolCalls(tools: unknown[]): Array<{ toolName: string; args: string[] }> {
        const result: Array<{ toolName: string; args: string[] }> = [];

        for (const item of tools) {
            // Exec form: array like ["kubectl", "get", "pods"] or ["emit_chat_message", "message"]
            if (Array.isArray(item) && item.length > 0) {
                const toolName = String(item[0]);
                const execArgs = item.slice(1);

                result.push({
                    toolName,
                    args: execArgs,
                });
            }
        }

        return result;
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
        tools: unknown[],
        allowedTools?: string[]
    ): Promise<Array<{ toolName: string; success: boolean; result?: unknown; error?: string }>> {
        if (!tools?.length) return [];

        // Check for abort before processing tools
        throwIfAborted(state, 'Tool execution aborted');

        const registry = getToolRegistry(); // assume global registration
        const results: Array<{ toolName: string; success: boolean; result?: unknown; error?: string }> = [];

        const normalized = this.normalizeToolCalls(tools);

        for (const { toolName, args } of normalized) {
            // Check for abort before each tool execution
            throwIfAborted(state, `Tool execution aborted before ${toolName}`);
            
            // Generate unique tool run ID for this execution
            const toolRunId = `${toolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Disallowed → emit tool call and failure, then continue
            if (allowedTools?.length && !allowedTools.includes(toolName)) {
                await this.emitToolCallEvent(state, toolRunId, toolName, { args });
                await this.emitToolResultEvent(state, toolRunId, false, `Tool not allowed in this node: ${toolName}`);
                
                await this.appendToolResultMessage(state, toolName, {
                    toolName,
                    success: false,
                    error: `Tool not allowed in this node: ${toolName}`
                });
                results.push({ toolName, success: false, error: 'Not allowed' });
                continue;
            }

            const tool = registry.get(toolName);
            if (!tool) {
                await this.emitToolCallEvent(state, toolRunId, toolName, { args });
                await this.emitToolResultEvent(state, toolRunId, false, `Unknown tool: ${toolName}`);
                
                await this.appendToolResultMessage(state, toolName, {
                    toolName,
                    success: false,
                    error: `Unknown tool: ${toolName}`
                });
                results.push({ toolName, success: false, error: 'Unknown tool' });
                continue;
            }

            // Emit tool call event before execution
            await this.emitToolCallEvent(state, toolRunId, toolName, { args });

            try {
                const outcome = await tool.execute(state, { toolName, args });

                // Emit tool result event on success
                await this.emitToolResultEvent(state, toolRunId, outcome.success, outcome.error, outcome.result);

                await this.appendToolResultMessage(state, toolName, outcome);

                results.push({
                    toolName,
                    success: outcome.success,
                    result: outcome.result,
                    error: outcome.error
                });
            } catch (err: any) {
                const error = err.message || String(err);
                
                // Emit tool result event on error
                await this.emitToolResultEvent(state, toolRunId, false, error);
                
                await this.appendToolResultMessage(state, toolName, {
                    toolName,
                    success: false,
                    error
                });
                results.push({ toolName, success: false, error });
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

        let toolHelpInfo = null;
        if (!result.success) {
            try {
                const { getToolRegistry, registerDefaultTools } = await import('../tools');
                registerDefaultTools();
                const registry = getToolRegistry();
                const tool = registry.get(action);
                if (tool) toolHelpInfo = tool.getPlanningInstructions();
            } catch { }
        }

        const content = JSON.stringify(
            {
                tool: action,
                success: result.success,
                error: result.error || null,
                result: result.result && JSON.stringify(result.result).length < 5000
                    ? result.result
                    : '[truncated — see logs]',
                helpInfo: toolHelpInfo,
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
        await this.executeToolCalls(state, [toolCall]);
    }
}