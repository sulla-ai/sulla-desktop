import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { getAgentPersonaRegistry } from '@pkg/agent';

const CHAT_COMPLETIONS_PORT = parseInt('3000', 10);

export class ChatCompletionsServer {
  private app = express();
  private server: any = null;

  constructor() {
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Enable CORS for all origins (since this is a public API)
    this.app.use(cors({
      origin: true, // Allow all origins
      credentials: true
    }));

    // Parse JSON bodies
    this.app.use(express.json({ limit: '10mb' }));

    // Add request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`[ChatCompletionsAPI] ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // OpenAI-compatible chat completions endpoint
    this.app.post('/chat/completions', this.handleChatCompletions.bind(this));

    // Catch-all for unknown routes
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: {
          message: `Endpoint ${req.method} ${req.path} not found`,
          type: 'invalid_request_error'
        }
      });
    });
  }

  private async handleChatCompletions(req: Request, res: Response) {
    try {
      const { messages, model = 'sulla', temperature = 0.7, max_tokens, stream = false } = req.body;

      // Validate request
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({
          error: {
            message: 'messages array is required',
            type: 'invalid_request_error'
          }
        });
      }

      // Get the last user message
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.role !== 'user') {
        return res.status(400).json({
          error: {
            message: 'Last message must be from user',
            type: 'invalid_request_error'
          }
        });
      }

      // Get the agent registry and send message
      const registry = getAgentPersonaRegistry();
      const activePersonaService = registry.getActivePersonaService();

      if (!activePersonaService) {
        return res.status(503).json({
          error: {
            message: 'Chat service is not available',
            type: 'service_unavailable'
          }
        });
      }

      // For streaming responses, we'd need to implement SSE
      if (stream) {
        return res.status(400).json({
          error: {
            message: 'Streaming is not yet implemented',
            type: 'not_implemented'
          }
        });
      }

      // Extract the user message content
      const userText = typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

      console.log(`[ChatCompletionsAPI] Processing message: ${userText.substring(0, 100)}...`);

      // Send the user message to the agent
      const messageId = `chatcmpl-${Date.now()}`;
      const sent = activePersonaService.addUserMessage('chat-api', userText);

      if (!sent) {
        return res.status(500).json({
          error: {
            message: 'Failed to send message to agent',
            type: 'internal_error'
          }
        });
      }

      // For now, return a structured response indicating the message was accepted
      // In a full implementation, this would wait for the agent's response
      // and return it in OpenAI format
      const response = {
        id: messageId,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: `Message received and forwarded to Sulla agent. The agent is processing your request: "${userText.substring(0, 50)}${userText.length > 50 ? '...' : ''}"\n\nNote: Real-time response integration is still being implemented. Check the Sulla Desktop application for the actual response.`
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: Math.ceil(userText.length / 4), // Rough estimate
          completion_tokens: 50, // Rough estimate
          total_tokens: Math.ceil(userText.length / 4) + 50
        }
      };

      console.log(`[ChatCompletionsAPI] Response sent for message ID: ${messageId}`);
      res.json(response);

    } catch (error) {
      console.error('[ChatCompletionsAPI] Error handling chat completion:', error);
      res.status(500).json({
        error: {
          message: 'Internal server error',
          type: 'internal_error'
        }
      });
    }
  }

  async start(port: number = CHAT_COMPLETIONS_PORT): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(port, '0.0.0.0', () => {
          console.log(`[ChatCompletionsAPI] Server listening on http://0.0.0.0:${port}`);
          console.log(`[ChatCompletionsAPI] Health check: http://localhost:${port}/health`);
          console.log(`[ChatCompletionsAPI] Chat completions: http://localhost:${port}/chat/completions`);
          resolve();
        });

        this.server.on('error', (error: any) => {
          console.error('[ChatCompletionsAPI] Server error:', error);
          reject(error);
        });
      } catch (error) {
        console.error('[ChatCompletionsAPI] Failed to start server:', error);
        reject(error);
      }
    });
  }

  stop(): void {
    if (this.server) {
      console.log('[ChatCompletionsAPI] Stopping server...');
      this.server.close(() => {
        console.log('[ChatCompletionsAPI] Server stopped');
      });
      this.server = null;
    }
  }
}

// Singleton instance
let chatCompletionsServer: ChatCompletionsServer | null = null;

export function getChatCompletionsServer(): ChatCompletionsServer {
  if (!chatCompletionsServer) {
    chatCompletionsServer = new ChatCompletionsServer();
  }
  return chatCompletionsServer;
}
