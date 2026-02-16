// src/tools/base.ts
export interface ToolMetadata extends Record<string, unknown> {
  category: string;
  requiresApproval?: boolean;
  isReadOnly?: boolean;
}

type FieldType = 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object';

interface FieldSchema {
  type: FieldType;
  enum?: string[];
  items?: FieldSchema;
  properties?: Record<string, FieldSchema>;
  description?: string;
  default?: unknown;
  optional?: boolean;
  nullable?: boolean;
}

type InputSchemaDef = Record<string, FieldSchema>;

interface ParsedInput {
  [key: string]: unknown;
}

export type ToolRegistration = {
  name: string;
  description: string;
  category: string;
  schemaDef: InputSchemaDef;
  workerClass: new () => BaseTool;
};

export abstract class BaseTool<TState = any> {
  abstract name: string;
  abstract description: string;
  abstract schemaDef: InputSchemaDef;

  metadata: ToolMetadata = { category: "general" };

  // ─────────────────────────────────────────────────────────────
  // Runtime validation + JSON schema generation
  // ─────────────────────────────────────────────────────────────

  protected parseInput(raw: unknown): ParsedInput {
    const result: ParsedInput = {};
    const errors: string[] = [];

    for (const [key, spec] of Object.entries(this.schemaDef)) {
      const value = (raw as any)?.[key];

      if (value === undefined || value === null) {
        if (!spec.optional) errors.push(`Missing required field: ${key}`);
        if (spec.default !== undefined) result[key] = spec.default;
        continue;
      }

      switch (spec.type) {
        case 'string':
          if (typeof value !== 'string') errors.push(`Invalid type for ${key}: expected string`);
          result[key] = String(value);
          break;
        case 'number':
          const num = Number(value);
          if (isNaN(num)) errors.push(`Invalid number for ${key}`);
          result[key] = num;
          break;
        case 'boolean':
          result[key] = !!value;
          break;
        case 'enum':
          if (!spec.enum?.includes(value as string)) {
            errors.push(`Invalid value for ${key}: must be one of ${spec.enum?.join(', ')}`);
          }
          result[key] = value;
          break;
        case 'array':
          if (!Array.isArray(value)) errors.push(`Expected array for ${key}`);
          result[key] = value;
          break;
        case 'object':
          if (typeof value !== 'object' || value === null) errors.push(`Expected object for ${key}`);
          result[key] = value;
          break;
      }
    }

    if (errors.length) throw new Error(`Input validation failed:\n${errors.join('\n')}`);

    return result;
  }

  protected get jsonSchema(): any {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [key, spec] of Object.entries(this.schemaDef)) {
      const field: any = { description: spec.description || '' };

      switch (spec.type) {
        case 'string':    field.type = 'string'; break;
        case 'number':    field.type = 'number'; break;
        case 'boolean':   field.type = 'boolean'; break;
        case 'enum':
          field.type = 'string';
          field.enum = spec.enum;
          break;
        case 'array':
          field.type = 'array';
          if (spec.items) field.items = this.fieldToJsonSchema(spec.items);
          break;
        case 'object':
          field.type = 'object';
          if (spec.properties) field.properties = Object.fromEntries(
            Object.entries(spec.properties).map(([k, v]) => [k, this.fieldToJsonSchema(v)])
          );
          break;
      }

      if (spec.default !== undefined) field.default = spec.default;
      properties[key] = field;
      if (!spec.optional) required.push(key);
    }

    return {
      type: 'object',
      properties,
      required,
      additionalProperties: false
    };
  }

  private fieldToJsonSchema(spec: FieldSchema): any {
    const field: any = { type: spec.type === 'enum' ? 'string' : spec.type };
    if (spec.enum) field.enum = spec.enum;
    if (spec.description) field.description = spec.description;
    return field;
  }

  // LangChain / agent compatible shape (no inheritance needed)
  get lc_kwargs() {
    return {
      name: this.name,
      description: this.description,
      parameters: this.jsonSchema,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Execution entry point
  // ─────────────────────────────────────────────────────────────

  async call(rawInput: unknown): Promise<unknown> {
    const validated = this.parseInput(rawInput);
    return this._validatedCall(validated);
  }

  async invoke(input: unknown): Promise<unknown> {
    return this.call(input);  // or directly this._call(input) if you prefer
  }

  protected abstract _validatedCall(input: ParsedInput): Promise<unknown>;

  // ─────────────────────────────────────────────────────────────
  // Existing helpers
  // ─────────────────────────────────────────────────────────────

  public sendChatMessage?: (content: string, kind?: string) => Promise<boolean>;
  public emitProgress?: (data: any) => Promise<void>;

  protected async emitMessage(content: string, kind: string = "progress") {
    return this.sendChatMessage?.(content, kind) ?? false;
  }

  protected async emitProgressUpdate(data: any) {
    await this.emitProgress?.(data);
  }

  protected state: TState | null = null;
  setState(state: TState) { this.state = state; }
}