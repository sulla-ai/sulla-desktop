import fs from 'fs';
import path from 'path';

type LLMLogEvent = {
  direction: 'request' | 'response' | 'error';
  provider: string;
  model?: string;
  endpoint?: string;
  nodeName?: string;
  conversationId?: string;
  payload: unknown;
  attempt?: number;
};

const PROJECT_LOG_DIR = path.join(process.cwd(), 'log');
const LOG_FILE_PREFIX = 'llm-conversation';

function isEnabled(): boolean {
  return true;
}

function sanitizeToken(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120) || 'default';
}

function getLogFilePath(conversationId?: string): string {
  const fileToken = sanitizeToken(conversationId || 'default');

  fs.mkdirSync(PROJECT_LOG_DIR, { recursive: true });
  return path.join(PROJECT_LOG_DIR, `${LOG_FILE_PREFIX}-${fileToken}.log`);
}

function serializePayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

function sanitizeEventPayload(event: LLMLogEvent): unknown {
  if (event.direction !== 'request') {
    return event.payload;
  }

  if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) {
    return event.payload;
  }

  const payload = { ...(event.payload as Record<string, unknown>) };

  if ('tools' in payload) {
    delete payload.tools;
  }

  return payload;
}

export function writeLLMConversationEvent(event: LLMLogEvent): void {
  if (!isEnabled()) {
    return;
  }

  try {
    const filePath = getLogFilePath(event.conversationId);
    const lines = [
      '---',
      `timestamp: ${new Date().toISOString()}`,
      `direction: ${event.direction}`,
      `provider: ${event.provider}`,
      `model: ${event.model || 'unknown'}`,
      `endpoint: ${event.endpoint || 'unknown'}`,
      `nodeName: ${event.nodeName || 'unknown'}`,
      `conversationId: ${event.conversationId || 'default'}`,
      `attempt: ${typeof event.attempt === 'number' ? event.attempt : 'n/a'}`,
      'payload:',
      serializePayload(sanitizeEventPayload(event)),
      '',
    ];

    fs.appendFileSync(filePath, `${lines.join('\n')}\n`, { encoding: 'utf-8' });
  } catch (error) {
    console.error('[LLMConversationFileLogger] Failed to write event:', error);
  }
}
