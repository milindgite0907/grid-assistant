/**
 * openai-compatible: POST <base>/chat/completions. Covers OpenAI, Azure AI Foundry's
 * /openai/v1 endpoint, GitHub Models, Ollama, LM Studio, and vLLM.
 * json-http: POST the JSON prompt to the URL as-is and read a JSON answer. Covers a
 * Copilot or custom gateway you own.
 * demo: no model and no network. A clearly labeled rule-based responder for demos and
 * offline use; it only restates the supplied context.
 */
export const providerKinds = ['openai-compatible', 'json-http', 'demo'] as const;
export type ProviderKind = typeof providerKinds[number];
export const authSchemes = ['bearer', 'api-key', 'none'] as const;
export type AuthScheme = typeof authSchemes[number];

export type AiConfig = {
  provider: ProviderKind;
  authScheme: AuthScheme;
  endpoint: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  maxTokens: number;
};

export type Configuration = {
  ai?: AiConfig;
  missing: string[];
  model: string | null;
  provider: ProviderKind;
  providerHost: string | null;
};

function choice<T extends string>(value: string | undefined, options: readonly T[], fallback: T, name: string): T {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  const match = options.find((option) => option === normalized);
  if (!match) throw new Error(`${name} must be one of: ${options.join(', ')}.`);
  return match;
}

function integer(value: string | undefined, fallback: number, name: string, max: number): number {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}.`);
  }
  return Number(value);
}

export const demoModel = 'demo-rules (no AI model)';

export function loadConfiguration(env: NodeJS.ProcessEnv = process.env): Configuration {
  if (choice(env.AI_PROVIDER, providerKinds, 'openai-compatible', 'AI_PROVIDER') === 'demo') {
    return {
      missing: [], model: demoModel, provider: 'demo', providerHost: 'local demo responder',
      ai: { provider: 'demo', authScheme: 'none', endpoint: '', model: demoModel, apiKey: '', timeoutMs: 5000, maxTokens: 1200 },
    };
  }
  const base = env.OPENAI_BASE_URL?.trim();
  const model = env.OPENAI_MODEL?.trim() || null;
  const apiKey = env.OPENAI_API_KEY?.trim() || '';
  let url: URL | undefined;
  if (base) {
    url = new URL(base);
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
      throw new Error('OPENAI_BASE_URL requires HTTPS, except for loopback development endpoints.');
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new Error('OPENAI_BASE_URL must not contain credentials, query parameters, or a fragment.');
    }
  }
  const local = !!url && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  const provider = choice(env.AI_PROVIDER, providerKinds, 'openai-compatible', 'AI_PROVIDER');
  const authScheme = choice(env.AI_AUTH_SCHEME, authSchemes, 'bearer', 'AI_AUTH_SCHEME');
  const missing = [
    ...(!url ? ['OPENAI_BASE_URL'] : []),
    ...(!model ? ['OPENAI_MODEL'] : []),
    ...(!apiKey && !local && authScheme !== 'none' ? ['OPENAI_API_KEY'] : []),
  ];
  const timeoutMs = integer(env.OPENAI_TIMEOUT_MS, 45_000, 'OPENAI_TIMEOUT_MS', 120_000);
  const maxTokens = integer(env.OPENAI_MAX_TOKENS, 1200, 'OPENAI_MAX_TOKENS', 8192);
  return {
    missing,
    model,
    provider,
    providerHost: url?.host ?? null,
    ai: missing.length === 0 && url && model
      ? {
          provider, authScheme,
          endpoint: provider === 'json-http' ? url.href : `${url.href.replace(/\/+$/, '')}/chat/completions`,
          model, apiKey, timeoutMs, maxTokens,
        }
      : undefined,
  };
}
