import type { AgentTool } from '@/core/actions/agent';
import { getEnv } from '@/lib/env';

// ── Public types ──────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmResponse {
  text: string;
  toolCalls: ToolCall[];
}

export interface LlmProvider {
  complete(messages: ChatMessage[], tools: AgentTool[]): Promise<LlmResponse>;
}

export interface LlmProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

// ── JSON Schema extraction (manual — no zod-to-json-schema dep) ─

interface JsonSchemaProperty {
  type?: string;
  description?: string;
}

interface JsonSchema {
  type: string;
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
}

function extractJsonSchema(schema: unknown): Record<string, unknown> {
  // Access ZodObject internal shape via _def
  const zodSchema = schema as { _def?: { shape?: () => Record<string, unknown>; typeName?: string } };

  if (!zodSchema._def || zodSchema._def.typeName !== 'ZodObject') {
    return { type: 'object', properties: {} };
  }

  const shapeFn = zodSchema._def.shape;
  if (typeof shapeFn !== 'function') {
    return { type: 'object', properties: {} };
  }

  const shape = shapeFn();
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  for (const [key, field] of Object.entries(shape)) {
    const fieldDef = (field as { _def?: { typeName?: string; description?: string; values?: string[] } })._def;
    if (!fieldDef) continue;

    const prop: Record<string, unknown> = {};
    const description = fieldDef.description;

    if (fieldDef.typeName === 'ZodString') {
      prop.type = 'string';
    } else if (fieldDef.typeName === 'ZodNumber') {
      prop.type = 'number';
    } else if (fieldDef.typeName === 'ZodBoolean') {
      prop.type = 'boolean';
    } else if (fieldDef.typeName === 'ZodEnum') {
      prop.type = 'string';
      if (fieldDef.values) {
        prop.enum = fieldDef.values;
      }
    } else {
      prop.type = 'string'; // fallback
    }

    if (description) {
      prop.description = description;
    }

    properties[key] = prop;

    // Check if optional by looking at the wrapper type
    const fieldWrapper = field as { _def?: { typeName?: string; innerType?: unknown } };
    const isOptional = fieldWrapper._def?.typeName === 'ZodOptional' ||
      fieldDef.typeName === 'ZodOptional';

    if (!isOptional) {
      required.push(key);
    }
  }

  const result: Record<string, unknown> = {
    type: 'object',
    properties,
  };

  if (required.length > 0) {
    result.required = required;
  }

  return result;
}

// ── Tool → OpenAI function format ─────────────────────────────

interface OpenAiTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

function toolToOpenAI(tool: AgentTool): OpenAiTool {
  return {
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: extractJsonSchema(tool.inputSchema),
    },
  };
}

// ── Factory ───────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://opencode.ai/zen/v1';
const DEFAULT_MODEL = 'opencode/gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 30_000;

export function createLlmProvider(config?: LlmProviderConfig): LlmProvider {
  const explicitApiKey = config?.apiKey;

  let apiKey: string | undefined;
  let model: string;
  let baseUrl: string;

  if (explicitApiKey) {
    // Fully explicit config — skip env validation (test-friendly)
    apiKey = explicitApiKey;
    model = config?.model ?? DEFAULT_MODEL;
    baseUrl = config?.baseUrl ?? DEFAULT_BASE_URL;
  } else {
    // Resolve from env with env validation
    const env = getEnv();
    apiKey = env.OPENCODE_ZEN_API_KEY;
    model = config?.model ?? env.IA_LLM_MODEL ?? DEFAULT_MODEL;
    baseUrl = config?.baseUrl ?? env.IA_LLM_BASE_URL ?? DEFAULT_BASE_URL;
  }

  return {
    async complete(messages: ChatMessage[], tools: AgentTool[]): Promise<LlmResponse> {
      if (!apiKey) {
        throw new Error('[LLM Provider] OPENCODE_ZEN_API_KEY is not configured. Set it in .env or pass via config.');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      const body: Record<string, unknown> = {
        model,
        messages,
      };

      if (tools.length > 0) {
        body.tools = tools.map(toolToOpenAI);
      }

      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          let errorBody = '';
          try {
            errorBody = JSON.stringify(await response.json());
          } catch {
            errorBody = await response.text().catch(() => '');
          }
          throw new Error(
            `[LLM Provider] API request failed with status ${response.status}: ${errorBody || response.statusText}`,
          );
        }

        const data = (await response.json()) as {
          choices?: Array<{
            message?: {
              content?: string | null;
              tool_calls?: Array<{
                id: string;
                type: string;
                function: { name: string; arguments: string };
              }>;
            };
          }>;
        };

        const choice = data.choices?.[0];
        const message = choice?.message;

        const text = message?.content ?? '';
        const toolCalls: ToolCall[] = (message?.tool_calls ?? []).map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
        }));

        return { text, toolCalls };
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}
