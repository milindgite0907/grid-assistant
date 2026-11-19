import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, get } from 'node:http';
import type { IncomingMessage, Server } from 'node:http';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { z } from 'zod';
import { chatResponseSchema, errorSchema, healthSchema, ordersSchema, promptsSchema } from '../shared/contracts.ts';
import type { ChatRequest } from '../shared/contracts.ts';
import { createApiServer } from './app.ts';
import { loadConfiguration } from './config.ts';
import { orders, prompts } from './data.ts';

async function listen(t: TestContext, server: Server): Promise<string> {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const address = server.address();
  assert(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}

function request(): ChatRequest {
  return {
    promptId: 'custom',
    text: 'Summarize this view.',
    parameters: {},
    context: { gridId: 'orders', selectedRowIds: ['order-001'], selectedRowCount: 1 },
  };
}

function post(base: string, body: unknown): Promise<Response> {
  return fetch(`${base}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

async function failure(response: Response, status: number, code: string): Promise<void> {
  assert.equal(response.status, status);
  const body = errorSchema.parse(await response.json());
  assert.equal(body.error.code, code);
}

test('health, orders, and prompts are available without AI configuration', async (t) => {
  const base = await listen(t, createApiServer(loadConfiguration({})));
  const health = healthSchema.parse(await (await fetch(`${base}/api/health`)).json());
  assert.equal(health.configured, false);
  assert(health.missing.includes('OPENAI_MODEL'));
  assert.equal(ordersSchema.parse(await (await fetch(`${base}/api/orders`)).json()).length, 36);
  assert.equal(promptsSchema.parse(await (await fetch(`${base}/api/prompts`)).json()).length, 6);
  await failure(await post(base, request()), 503, 'AI_NOT_CONFIGURED');
  await failure(await fetch(`${base}/api/unknown`), 404, 'NOT_FOUND');
});

test('configuration validates endpoints and numbers without exposing keys', async (t) => {
  assert.throws(() => loadConfiguration({ OPENAI_BASE_URL: 'http://example.com' }), /HTTPS/);
  assert.throws(() => loadConfiguration({ OPENAI_BASE_URL: 'https://example.com/v1?key=value' }), /query/);
  assert.throws(() => loadConfiguration({ OPENAI_TIMEOUT_MS: '-1' }), /integer/);
  assert.throws(() => loadConfiguration({ OPENAI_MAX_TOKENS: '9000' }), /integer/);
  const config = loadConfiguration({
    OPENAI_BASE_URL: 'https://example.com/v1/', OPENAI_MODEL: 'test-model', OPENAI_API_KEY: 'test-only-not-a-real-key',
  });
  assert.equal(config.ai?.endpoint, 'https://example.com/v1/chat/completions');
  const base = await listen(t, createApiServer(config));
  const response = await (await fetch(`${base}/api/health`)).text();
  assert(!response.includes('test-only-not-a-real-key'));
  assert.equal(healthSchema.parse(JSON.parse(response)).configured, true);
});

test('rejects invalid JSON, content type, request shape, and oversized payloads explicitly', async (t) => {
  const base = await listen(t, createApiServer(loadConfiguration({})));
  await failure(await fetch(`${base}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  }), 400, 'INVALID_JSON');
  await failure(await fetch(`${base}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json-evil' }, body: '{}',
  }), 415, 'JSON_REQUIRED');
  await failure(await post(base, { ...request(), text: '   ' }), 400, 'INVALID_REQUEST');
  await failure(await post(base, { ...request(), context: { gridId: 'orders', rows: orders } }), 400, 'INVALID_REQUEST');
  await failure(await post(base, { text: 'x'.repeat(70_000) }), 413, 'REQUEST_TOO_LARGE');
});

test('rejects unknown, duplicate, inconsistent, and over-cap selections', async (t) => {
  const base = await listen(t, createApiServer(loadConfiguration({})));
  for (const context of [
    { gridId: 'orders', selectedRowIds: ['unknown'] },
    { gridId: 'orders', selectedRowIds: ['order-001', 'order-001'] },
    { gridId: 'orders', selectedRowIds: ['order-001'], selectedRowCount: 0 },
  ]) {
    await failure(await post(base, { ...request(), context }), 400, 'INVALID_SELECTION');
  }
  await failure(await post(base, {
    ...request(), context: { gridId: 'orders', selectedRowIds: orders.slice(0, 21).map((order) => order.id) },
  }), 400, 'INVALID_REQUEST');
});

test('saved prompts must match the library and satisfy declared parameters', async (t) => {
  const base = await listen(t, createApiServer(loadConfiguration({})));
  const prompt = prompts.find((entry) => entry.id === 'audience-summary');
  assert(prompt);
  const saved = { ...request(), promptId: prompt.id, text: prompt.displayPrompt };
  await failure(await post(base, saved), 400, 'MISSING_PARAMETER');
  await failure(await post(base, { ...saved, parameters: { Unknown: 'value' } }), 400, 'INVALID_PARAMETERS');
  await failure(await post(base, { ...saved, text: 'Modified prompt' }), 400, 'INVALID_PROMPT');
  await failure(await post(base, { ...saved, parameters: { Audience: 'Operations' } }), 503, 'AI_NOT_CONFIGURED');
  await failure(await post(base, { ...request(), parameters: { Audience: 'Operations' } }), 400, 'INVALID_PARAMETERS');
});

test('accepts only local host and playground browser origins', async (t) => {
  const base = await listen(t, createApiServer(loadConfiguration({})));
  await failure(await fetch(`${base}/api/health`, { headers: { Origin: 'https://untrusted.example' } }), 403, 'ORIGIN_NOT_ALLOWED');
  const invalidHost = await new Promise<IncomingMessage>((resolve, reject) => {
    get(`${base}/api/health`, { headers: { Host: 'untrusted.example' } }, resolve).on('error', reject);
  });
  assert.equal(invalidHost.statusCode, 403);
  invalidHost.resume();
  assert.equal((await fetch(`${base}/api/health`, { headers: { Origin: 'http://127.0.0.1:5187' } })).status, 200);
});

const providerRequestSchema = z.object({
  model: z.string(), max_tokens: z.number(),
  messages: z.array(z.object({ role: z.string(), content: z.string() })),
});

test('calls a local test provider with verified summaries and no raw rows or history', async (t) => {
  let captured: unknown;
  const provider = await listen(t, createServer(async (req, res) => {
    assert.equal(req.url, '/v1/chat/completions');
    let text = '';
    for await (const chunk of req) text += chunk;
    captured = JSON.parse(text);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: 'Test-provider response.' }, finish_reason: 'length' }] }));
  }));
  const base = await listen(t, createApiServer(loadConfiguration({
    OPENAI_BASE_URL: `${provider}/v1`, OPENAI_MODEL: 'local-test-model',
  })));
  const payload = request();
  payload.context.filters = { status: 'Open' };
  payload.context.summaries = { filteredAmount: 999_999_999, selectedAmount: 999_999_999 };
  payload.context.selectedRowCount = 25;
  payload.context.selectedRowIdsTruncated = true;
  const response = await post(base, payload);
  assert.equal(response.status, 200);
  const result = chatResponseSchema.parse(await response.json());
  assert.equal(result.answer, 'Test-provider response.');
  assert.match(result.warning ?? '', /token/);
  assert.equal(result.context.filtered.amount, orders.filter((order) => order.status === 'Open').reduce((sum, order) => sum + order.amount, 0));
  assert.equal(result.context.includedSelection.amount, 125);
  assert.equal(result.context.includedSelection.rowCount, 1);
  assert.equal(result.context.selectionTruncated, true);
  const sent = providerRequestSchema.parse(captured);
  assert.equal(sent.model, 'local-test-model');
  assert.equal(sent.messages.length, 2);
  assert(sent.messages[0].content.includes('caller-reported'));
  const userMessage = JSON.parse(sent.messages[1].content);
  assert.deepEqual(userMessage.context, result.context);
  assert(!JSON.stringify(captured).includes('999999999'));
  assert(!JSON.stringify(captured).includes('Contoso'));
  assert(!('rows' in userMessage.context));
});

for (const scenario of [
  { name: 'rejection', status: 401, body: '{"private":"sensitive upstream details"}', code: 'PROVIDER_REJECTED' },
  { name: 'invalid JSON', status: 200, body: '<html>error</html>', code: 'INVALID_PROVIDER_RESPONSE' },
  { name: 'empty answer', status: 200, body: '{"choices":[{"message":{"content":""}}]}', code: 'INVALID_PROVIDER_RESPONSE' },
]) {
  test(`sanitizes provider ${scenario.name}`, async (t) => {
    const provider = await listen(t, createServer((_, res) => {
      res.writeHead(scenario.status);
      res.end(scenario.body);
    }));
    const base = await listen(t, createApiServer(loadConfiguration({
      OPENAI_BASE_URL: provider, OPENAI_MODEL: 'local-test-model',
    })));
    const response = await post(base, request());
    const text = await response.text();
    assert.equal(response.status, 502);
    assert.equal(errorSchema.parse(JSON.parse(text)).error.code, scenario.code);
    assert(!text.includes('sensitive upstream'));
  });
}

test('provider timeouts return an explicit 504', async (t) => {
  const provider = await listen(t, createServer(() => { /* Intentionally never responds. */ }));
  const base = await listen(t, createApiServer(loadConfiguration({
    OPENAI_BASE_URL: provider, OPENAI_MODEL: 'local-test-model', OPENAI_TIMEOUT_MS: '50',
  })));
  await failure(await post(base, request()), 504, 'PROVIDER_TIMEOUT');
});

test('provider timeouts also cover a stalled response body', async (t) => {
  const provider = await listen(t, createServer((_, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.write('{"choices":');
  }));
  const base = await listen(t, createApiServer(loadConfiguration({
    OPENAI_BASE_URL: provider, OPENAI_MODEL: 'local-test-model', OPENAI_TIMEOUT_MS: '100',
  })));
  await failure(await post(base, request()), 504, 'PROVIDER_TIMEOUT');
});

test('limits concurrent requests to the configured provider', async (t) => {
  let reached = 0;
  let ready: () => void = () => { throw new Error('Barrier not initialized'); };
  const bothStarted = new Promise<void>((resolve) => { ready = resolve; });
  const provider = await listen(t, createServer(() => {
    reached += 1;
    if (reached === 2) ready();
  }));
  const base = await listen(t, createApiServer(loadConfiguration({
    OPENAI_BASE_URL: provider, OPENAI_MODEL: 'local-test-model', OPENAI_TIMEOUT_MS: '1500',
  })));
  const first = post(base, request());
  const second = post(base, request());
  await bothStarted;
  await failure(await post(base, request()), 429, 'ASSISTANT_BUSY');
  await Promise.all([first, second]);
});
