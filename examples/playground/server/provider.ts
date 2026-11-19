import { z } from 'zod';
import type { AiConfig } from './config.ts';
import { ApiError } from './errors.ts';
import { demoOutput } from './demo.ts';

export type PromptMessage = { role: 'system' | 'user'; content: string };

/** Provider-neutral prompt. Each adapter maps it onto its provider's wire format. */
export type JsonPrompt = {
  task: string;
  messages: PromptMessage[];
  /** JSON Schema of the JSON object the provider must return. */
  responseSchema: Record<string, unknown>;
};

export type JsonResult = { output: unknown; truncated: boolean };

const completionSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string().trim().min(1) }),
    finish_reason: z.string().nullish(),
  })).min(1),
});

const timeoutError = () => new ApiError(504, 'PROVIDER_TIMEOUT', 'The assistant request timed out or was cancelled. Retry when ready.');

function authHeaders(config: AiConfig): Record<string, string> {
  if (!config.apiKey || config.authScheme === 'none') return {};
  return config.authScheme === 'api-key'
    ? { 'api-key': config.apiKey }
    : { Authorization: 'Bearer ' + config.apiKey };
}

/** Posts JSON to the configured endpoint. Non-2xx statuses are returned, not thrown, so callers can adapt. */
export async function postJson(
  config: AiConfig,
  body: unknown,
  signal: AbortSignal,
): Promise<{ status: number; body?: unknown }> {
  const providerSignal = AbortSignal.any([signal, AbortSignal.timeout(config.timeoutMs)]);
  let response: Response;
  try {
    response = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(config) },
      signal: providerSignal,
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw timeoutError();
    throw new ApiError(502, 'PROVIDER_UNREACHABLE', 'Unable to reach the configured AI endpoint. Check the backend configuration and network.');
  }
  if (!response.ok) {
    await response.body?.cancel();
    return { status: response.status };
  }
  try {
    return { status: response.status, body: await response.json() };
  } catch {
    if (providerSignal.aborted) throw timeoutError();
    throw new ApiError(502, 'INVALID_PROVIDER_RESPONSE', 'The AI provider returned invalid JSON.');
  }
}

export function rejected(status: number): ApiError {
  return new ApiError(502, 'PROVIDER_REJECTED', `The AI provider returned HTTP ${status}. Check the model, endpoint, API key, and quota.`);
}

export function parseChatCompletion(body: unknown): { text: string; truncated: boolean } {
  const parsed = completionSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(502, 'INVALID_PROVIDER_RESPONSE', 'The AI provider did not return a non-empty chat completion.');
  }
  return { text: parsed.data.choices[0].message.content, truncated: parsed.data.choices[0].finish_reason === 'length' };
}

/** Models often wrap JSON in prose or code fences despite instructions. */
export function extractJson(text: string): unknown {
  const candidates = [text, text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/gi, '')];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch { /* Try the next candidate. */ }
  }
  throw new ApiError(502, 'INVALID_PROVIDER_RESPONSE', 'The AI provider did not return valid JSON.');
}

/** JSON in, JSON out, regardless of which provider kind is configured. */
export async function runJsonPrompt(config: AiConfig, prompt: JsonPrompt, signal: AbortSignal): Promise<JsonResult> {
  if (config.provider === 'demo') return { output: demoOutput(prompt), truncated: false };
  if (config.provider === 'json-http') {
    const result = await postJson(config, {
      task: prompt.task,
      model: config.model,
      maxTokens: config.maxTokens,
      messages: prompt.messages,
      responseSchema: prompt.responseSchema,
    }, signal);
    if (result.body === undefined) throw rejected(result.status);
    return { output: result.body, truncated: false };
  }
  const send = (jsonMode: boolean) => postJson(config, {
    model: config.model,
    max_tokens: config.maxTokens,
    messages: prompt.messages,
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
  }, signal);
  let result = await send(true);
  // Some compatible servers reject response_format; the prompt still demands JSON.
  if (result.body === undefined && (result.status === 400 || result.status === 422)) result = await send(false);
  if (result.body === undefined) throw rejected(result.status);
  const { text, truncated } = parseChatCompletion(result.body);
  return { output: extractJson(text), truncated };
}
