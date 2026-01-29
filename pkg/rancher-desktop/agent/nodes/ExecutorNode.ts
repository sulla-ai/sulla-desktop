// ExecutorNode - Executes the plan (LLM calls, tool execution)

import type { ThreadState, NodeResult } from '../types';
import { BaseNode } from './BaseNode';

export class ExecutorNode extends BaseNode {
  constructor() {
    super('executor', 'Executor');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    console.log(`[Agent:Executor] Executing...`);
    const plan = state.metadata.plan as { requiresTools: boolean; steps: string[] } | undefined;

    // Execute tools if needed
    if (plan?.requiresTools) {
      console.log(`[Agent:Executor] Tools required but not yet implemented`);
      state.metadata.toolResults = { message: 'Tool execution not yet implemented' };
    }

    // Generate LLM response using BaseNode helpers
    console.log(`[Agent:Executor] Generating LLM response...`);
    const response = await this.generateResponse(state);

    if (response) {
      console.log(`[Agent:Executor] Response generated (${response.content.length} chars)`);
      state.metadata.response = response.content;
      state.metadata.ollamaModel = response.model;
      state.metadata.ollamaEvalCount = response.evalCount;
      state.metadata.executorCompleted = true;
    } else {
      console.error(`[Agent:Executor] Failed to generate response`);
      state.metadata.error = 'Failed to generate response';
    }

    return { state, next: 'continue' };
  }

  private async generateResponse(state: ThreadState) {
    // Get the current user message
    const lastUserMessage = state.messages.filter(m => m.role === 'user').pop();

    if (!lastUserMessage) {
      return null;
    }

    // Build instruction with user query
    let instruction = `User: ${ lastUserMessage.content }`;

    // Add tool results if any
    if (state.metadata.toolResults) {
      instruction = `Tool results:\n${ JSON.stringify(state.metadata.toolResults) }\n\n${ instruction }`;
    }

    // Add prompt prefix/suffix if set by other nodes
    if (state.metadata.promptPrefix) {
      instruction = `${ state.metadata.promptPrefix }\n\n${ instruction }`;
    }

    if (state.metadata.promptSuffix) {
      instruction = `${ instruction }\n\n${ state.metadata.promptSuffix }`;
    }

    // Use BaseNode's buildContextualPrompt and prompt helpers
    const fullPrompt = this.buildContextualPrompt(instruction, state, {
      includeMemory:  true,
      includeHistory: true,
    });

    return this.prompt(fullPrompt);
  }
}
