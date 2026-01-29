// PlannerNode - Decides next step(s) based on current state

import type { ThreadState, NodeResult } from '../types';
import { BaseNode } from './BaseNode';

export class PlannerNode extends BaseNode {
  constructor() {
    super('planner', 'Planner');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    console.log(`[Agent:Planner] Executing...`);
    const lastUserMessage = state.messages.filter(m => m.role === 'user').pop();

    if (!lastUserMessage) {
      console.log(`[Agent:Planner] No user message, ending`);

      return { state, next: 'end' };
    }

    // Analyze the request to determine if tools are needed
    const needsTools = await this.analyzeRequest(lastUserMessage.content, state);

    if (needsTools) {
      console.log(`[Agent:Planner] Tools required: ${needsTools.steps.join(', ')}`);
      state.metadata.plan = {
        requiresTools: true,
        steps:         needsTools.steps || ['execute_tool'],
      };

      return { state, next: 'executor' };
    }

    console.log(`[Agent:Planner] Simple request, proceeding to executor`);
    state.metadata.plan = {
      requiresTools: false,
      steps:         ['generate_response'],
    };

    return { state, next: 'executor' };
  }

  private async analyzeRequest(
    query: string,
    state: ThreadState,
  ): Promise<{ steps: string[] } | null> {
    // Simple heuristic for now - check for tool-related keywords
    const toolKeywords = [
      'search',
      'find',
      'look up',
      'browse',
      'open',
      'file',
      'read',
      'write',
      'calculate',
      'run',
      'execute',
    ];

    const queryLower = query.toLowerCase();
    const needsTool = toolKeywords.some(kw => queryLower.includes(kw));

    if (needsTool) {
      return { steps: ['execute_tool', 'generate_response'] };
    }

    // For more complex planning, we could use LLM
    // For now, return null for simple responses
    return null;
  }
}
