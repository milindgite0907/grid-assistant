export type AiConfig = {
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
  providerHost: string | null;
};

function integer(value: string | undefined, fallback: number, name: string, max: number): number {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}.`);
  }
  return Number(value);
}

export function loadConfiguration(env: NodeJS.ProcessEnv = process.env): Configuration {
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
  const missing = [
    ...(!url ? ['OPENAI_BASE_URL'] : []),
    ...(!model ? ['OPENAI_MODEL'] : []),
    ...(!apiKey && !local ? ['OPENAI_API_KEY'] : []),
  ];
  const timeoutMs = integer(env.OPENAI_TIMEOUT_MS, 45_000, 'OPENAI_TIMEOUT_MS', 120_000);
  const maxTokens = integer(env.OPENAI_MAX_TOKENS, 1200, 'OPENAI_MAX_TOKENS', 8192);
  return {
    missing,
    model,
    providerHost: url?.host ?? null,
    ai: missing.length === 0 && url && model
      ? {
          endpoint: `${url.href.replace(/\/+$/, '')}/chat/completions`,
          model, apiKey, timeoutMs, maxTokens,
        }
      : undefined,
  };
}
