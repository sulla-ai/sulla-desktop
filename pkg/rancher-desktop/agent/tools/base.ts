// src/tools/base.ts
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { BaseThreadState } from '../nodes/Graph';

export interface ToolMetadata extends Record<string, unknown> {
  category: string;
  requiresApproval?: boolean;   // e.g. for dangerous actions
  isReadOnly?: boolean;
}

export abstract class BaseTool<TState = BaseThreadState> extends StructuredTool {
  // Required by LangChain
  abstract name: string;
  abstract description: string;
  abstract schema: z.ZodType<any>;

  // Optional but recommended for our registry system
  metadata: ToolMetadata = { category: "general" };

  // This is what the model actually calls
  protected abstract _call(
    input: z.infer<this["schema"]>
  ): Promise<unknown>;

  // Auto-generates the JSON schema for the LLM (native tool calling)
  // @ts-expect-error Overriding inherited property with accessor for computed value
  get lc_kwargs() {
    return {
      name: this.name,
      description: this.description,
      schema: this.schema,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // WebSocket helpers (injected by BaseNode during execution)
  // ─────────────────────────────────────────────────────────────
  public sendChatMessage?: (content: string, kind?: string) => Promise<boolean>;
  public emitProgress?: (data: any) => Promise<void>;

  /**
   * Tools can call this to send a message to the user
   */
  protected async emitMessage(content: string, kind: string = "progress"): Promise<boolean> {
    if (this.sendChatMessage) {
      return await this.sendChatMessage(content, kind);
    }
    console.warn(`[${this.name}] WebSocket not available for emitMessage`);
    return false;
  }

  /**
   * Tools can call this to send progress / plan updates
   */
  protected async emitProgressUpdate(data: any): Promise<void> {
    if (this.emitProgress) {
      await this.emitProgress(data);
    }
  }


  // ─────────────────────────────────────────────────────────────
  // Graph State (injected by BaseNode during execution)
  // ─────────────────────────────────────────────────────────────

  protected state: TState | null = null;

  // Called by BaseNode before each invocation
  setState(state: TState) {
    this.state = state;
  }
}