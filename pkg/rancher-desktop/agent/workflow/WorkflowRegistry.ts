/**
 * WorkflowRegistry — routes incoming messages to the right workflow.
 *
 * External trigger sources (calendar, chat apps, desktop, API) call the registry
 * with a trigger type and a user message. The registry:
 *
 * 1. Scans all saved workflows for trigger nodes matching that type
 * 2. If one match → runs it directly
 * 3. If multiple matches → uses LLM to pick the best one based on triggerDescription
 * 4. Can also be called with a specific workflowId to skip selection
 */

import * as fs from 'fs';
import * as path from 'path';

import type {
  WorkflowDefinition,
  TriggerNodeSubtype,
} from '@pkg/pages/editor/workflow/types';

import { WorkflowExecutor } from './WorkflowExecutor';
import type { WorkflowExecutionEvent, WorkflowRunState } from './types';

// ── Types ──

export interface WorkflowDispatchOptions {
  /** The trigger type (e.g. 'calendar', 'chat-app', 'sulla-desktop') */
  triggerType: TriggerNodeSubtype;
  /** The user message or payload that triggered this */
  message: string;
  /** Optional: skip LLM selection and run this specific workflow */
  workflowId?: string;
  /** Callback for execution events (forwarded to the executor) */
  emitEvent?: (event: Omit<WorkflowExecutionEvent, 'executionId' | 'workflowId' | 'timestamp'>) => void;
}

export interface WorkflowDispatchResult {
  executionId: string;
  workflowId: string;
  workflowName: string;
  executor: WorkflowExecutor;
}

interface WorkflowCandidate {
  definition: WorkflowDefinition;
  triggerDescription: string;
}

// ── Registry ──

export class WorkflowRegistry {
  private workflowsDir: string;

  constructor(workflowsDir: string) {
    this.workflowsDir = workflowsDir;
  }

  /**
   * Dispatch a message to the appropriate workflow.
   * Returns the executor so callers can track or abort it.
   */
  async dispatch(options: WorkflowDispatchOptions): Promise<WorkflowDispatchResult | null> {
    const { triggerType, message, workflowId, emitEvent } = options;

    let definition: WorkflowDefinition;

    if (workflowId) {
      // Direct dispatch — skip selection
      definition = this.loadWorkflow(workflowId);
    } else {
      // Find candidates by trigger type
      const candidates = this.findCandidates(triggerType);

      if (candidates.length === 0) {
        console.log(`[WorkflowRegistry] No workflows found for trigger type: ${triggerType}`);
        return null;
      }

      if (candidates.length === 1) {
        definition = candidates[0].definition;
      } else {
        // Multiple candidates — use LLM to select
        const selected = await this.selectWorkflow(candidates, message);
        if (!selected) {
          console.log(`[WorkflowRegistry] LLM could not select a workflow for: "${message.slice(0, 100)}"`);
          return null;
        }
        definition = selected;
      }
    }

    // Create and start the executor
    const executor = new WorkflowExecutor(definition, message, { emitEvent });

    console.log(`[WorkflowRegistry] Dispatching to workflow "${definition.name}" (${definition.id}) via ${triggerType}`);

    // Run in background
    executor.execute().catch(err => {
      console.error(`[WorkflowRegistry] Workflow "${definition.id}" failed:`, err);
    });

    return {
      executionId:  executor.id,
      workflowId:   definition.id,
      workflowName: definition.name,
      executor,
    };
  }

  /**
   * Find all workflows that have a trigger node matching the given type.
   */
  findCandidates(triggerType: TriggerNodeSubtype): WorkflowCandidate[] {
    const candidates: WorkflowCandidate[] = [];

    if (!fs.existsSync(this.workflowsDir)) return candidates;

    const entries = fs.readdirSync(this.workflowsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

      try {
        const raw = fs.readFileSync(path.join(this.workflowsDir, entry.name), 'utf-8');
        const definition: WorkflowDefinition = JSON.parse(raw);

        // Only consider enabled workflows for production dispatch
        if (!definition.enabled) continue;

        // Find trigger nodes matching this type
        for (const node of definition.nodes) {
          if (
            node.data.category === 'trigger' &&
            node.data.subtype === triggerType &&
            node.data.config?.triggerDescription
          ) {
            candidates.push({
              definition,
              triggerDescription: node.data.config.triggerDescription as string,
            });
            break; // one match per workflow is enough
          }
        }
      } catch {
        // skip malformed files
      }
    }

    return candidates;
  }

  /**
   * Use LLM to select the best workflow for a given message.
   */
  private async selectWorkflow(
    candidates: WorkflowCandidate[],
    message: string,
  ): Promise<WorkflowDefinition | null> {
    const { getLLMService } = await import('@pkg/agent/languagemodels');
    const llm = await getLLMService('remote');

    const workflowList = candidates
      .map((c, i) => `${i + 1}. "${c.definition.name}": ${c.triggerDescription}`)
      .join('\n');

    const systemPrompt = `You are a workflow router. Given a user message, select which workflow should handle it.
Respond with ONLY the number (1, 2, 3, etc.) of the best matching workflow. If none are a good match, respond with "0".

Available workflows:
${workflowList}`;

    const response = await llm.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ]);

    const rawContent = typeof response === 'string' ? response : (response?.content ?? '');
    const selected = parseInt(rawContent.trim(), 10);

    if (selected > 0 && selected <= candidates.length) {
      return candidates[selected - 1].definition;
    }

    return null;
  }

  /**
   * Load a specific workflow by ID.
   */
  private loadWorkflow(workflowId: string): WorkflowDefinition {
    const filePath = path.join(this.workflowsDir, `${workflowId}.json`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
}

// ── Singleton ──

let instance: WorkflowRegistry | null = null;

export function getWorkflowRegistry(): WorkflowRegistry {
  if (!instance) {
    const { resolveSullaWorkflowsDir } = require('@pkg/agent/utils/sullaPaths');
    instance = new WorkflowRegistry(resolveSullaWorkflowsDir());
  }
  return instance;
}
