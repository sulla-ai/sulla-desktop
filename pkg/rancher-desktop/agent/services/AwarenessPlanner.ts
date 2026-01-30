import { getLLMService } from './LLMServiceFactory';
import { getAwarenessService } from './AwarenessService';

export class AwarenessPlanner {
  private lastRunAt = 0;
  private lastThreadId: string | null = null;

  async maybeUpdate(threadId: string, messages: Array<{ role: string; content: string }>): Promise<void> {
    const recentText = messages
      .slice(-20)
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    if (!this.shouldConsiderUpdate(recentText, threadId)) {
      return;
    }

    const awareness = getAwarenessService();
    await awareness.initialize();

    const llm = getLLMService();
    await llm.initialize();

    const current = awareness.getData();

    const prompt = `You maintain a global Awareness context for Sulla, a desktop assistant.

Current Awareness JSON:
${JSON.stringify(current)}

Recent conversation (most recent last):
${recentText}

Task:
Decide whether Awareness should be updated based on information that is important and durable (identity, relationship, user identity, stable preferences, long-running projects, or critical context). If it should not be updated, set update=false.

If the conversation references something that should be understood more deeply via MemoryPedia, include memory_search_hints as a newline-separated list of 1-5 short search queries.

Respond in JSON only:
{
  "update": true|false,
  "patch": {
    "agent_identity": "",
    "primary_user_identity": "",
    "other_user_identities": "",
    "long_term_context": "",
    "mid_term_context": "",
    "short_term_context": "",
    "memory_search_hints": ""
  },
  "reason": ""
}`;

    const response = await llm.generate(prompt);

    if (!response) {
      return;
    }

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return;
    }

    if (!parsed?.update || !parsed?.patch) {
      return;
    }

    await awareness.update(parsed.patch);

    this.lastRunAt = Date.now();
    this.lastThreadId = threadId;

    console.log('[AwarenessPlanner] Awareness updated', {
      threadId,
      reason: parsed.reason,
      patch: parsed.patch,
    });
  }

  private shouldConsiderUpdate(recentText: string, threadId: string): boolean {
    const now = Date.now();
    const COOLDOWN_MS = 5 * 60 * 1000;

    if (this.lastRunAt && (now - this.lastRunAt) < COOLDOWN_MS && this.lastThreadId === threadId) {
      return false;
    }

    const lower = recentText.toLowerCase();
    const triggers = [
      'remember',
      'save this',
      'store this',
      'awareness',
      'memorypedia',
      'chroma',
      'preference',
      'i prefer',
      'my preference',
      'my name is',
      'call me',
      'we decided',
      'going forward',
      'for the project',
      'in this repo',
      'architecture',
      'design decision',
      'requirement',
      'constraint',
      'relationship',
    ];

    if (triggers.some(t => lower.includes(t))) {
      return true;
    }

    // If the conversation is long, check less frequently; otherwise skip.
    const approxChars = recentText.length;
    if (approxChars > 2000) {
      return true;
    }

    return false;
  }
}

let instance: AwarenessPlanner | null = null;

export function getAwarenessPlanner(): AwarenessPlanner {
  if (!instance) {
    instance = new AwarenessPlanner();
  }

  return instance;
}
