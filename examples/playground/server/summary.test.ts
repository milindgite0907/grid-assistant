import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingMessage, Server } from 'node:http';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { errorSchema, rowSummaryResponseSchema } from '../shared/contracts.ts';
import { createApiServer } from './app.ts';
import { loadConfiguration } from './config.ts';
import { buildOrderSummaryContext } from './context.ts';
import { buildRowSummaryPrompt } from './summary.ts';

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

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  let text = '';
  for await (const chunk of req) text += chunk;
  return JSON.parse(text);
}

const summaryJson = { summary: 'A mid-sized open order.', highlights: ['Open status', 'Above regional average'] };

function summarize(base: string, body: unknown = { rowId: 'order-001' }): Promise<Response> {
  return fetch(`${base}/api/summary`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

test('the prompt is generated from the supplied context only', () => {
  const prompt = buildRowSummaryPrompt({
    table: { name: 'Tickets', recordName: 'ticket' },
    columns: [{ id: 'title', label: 'Title', type: 'text' }, { id: 'cost', label: 'Cost', type: 'currency', unit: 'EUR' }],
    record: { id: 't-1', values: { title: 'Printer jam', cost: 12 } },
    related: [{ label: 'Same requester', facts: { openTickets: 3 } }],
  });
  const [system, user] = prompt.messages;
  assert.match(system.content, /one ticket record from the "Tickets" table/);
  assert.match(system.content, /Cost \(cost, currency, EUR\)/);
  assert(!system.content.includes('Printer jam'));
  assert(user.content.includes('Printer jam') && user.content.includes('openTickets'));
  assert.equal(prompt.task, 'row-summary');
});

test('summarizes a row through an OpenAI-compatible provider, tolerating fenced JSON', async (t) => {
  let captured: Record<string, unknown> = {};
  const provider = await listen(t, createServer(async (req, res) => {
    captured = await readBody(req);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: '```json\n' + JSON.stringify(summaryJson) + '\n```' }, finish_reason: 'length' }] }));
  }));
  const base = await listen(t, createApiServer(loadConfiguration({ OPENAI_BASE_URL: `${provider}/v1`, OPENAI_MODEL: 'm' })));
  const response = await summarize(base);
  assert.equal(response.status, 200);
  const result = rowSummaryResponseSchema.parse(await response.json());
  assert.deepEqual(result.highlights, summaryJson.highlights);
  assert.equal(result.rowId, 'order-001');
  assert.match(result.warning ?? '', /token/);
  assert.deepEqual(captured.response_format, { type: 'json_object' });
  const messages = captured.messages as { content: string }[];
  assert.match(messages[0].content, /"Orders" table/);
  assert(messages[1].content.includes('Contoso'));
});

test('retries without response_format when a compatible server rejects it', async (t) => {
  const seen: boolean[] = [];
  const provider = await listen(t, createServer(async (req, res) => {
    const body = await readBody(req);
    seen.push('response_format' in body);
    if ('response_format' in body) {
      res.writeHead(400);
      res.end('unsupported');
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(summaryJson) } }] }));
  }));
  const base = await listen(t, createApiServer(loadConfiguration({ OPENAI_BASE_URL: provider, OPENAI_MODEL: 'm' })));
  assert.equal((await summarize(base)).status, 200);
  assert.deepEqual(seen, [true, false]);
});

test('summarizes through a generic JSON-over-HTTP provider with api-key auth', async (t) => {
  let headers: IncomingMessage['headers'] = {};
  let captured: Record<string, unknown> = {};
  const provider = await listen(t, createServer(async (req, res) => {
    headers = req.headers;
    captured = await readBody(req);
    assert.equal(req.url, '/summarize');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(summaryJson));
  }));
  const base = await listen(t, createApiServer(loadConfiguration({
    AI_PROVIDER: 'json-http', AI_AUTH_SCHEME: 'api-key', OPENAI_BASE_URL: `${provider}/summarize`,
    OPENAI_MODEL: 'gateway-model', OPENAI_API_KEY: 'test-only-not-a-real-key',
  })));
  const result = rowSummaryResponseSchema.parse(await (await summarize(base)).json());
  assert.equal(result.summary, summaryJson.summary);
  assert.equal(headers['api-key'], 'test-only-not-a-real-key');
  assert.equal(headers.authorization, undefined);
  assert.equal(captured.task, 'row-summary');
  assert.equal(captured.model, 'gateway-model');
  assert(Array.isArray(captured.messages) && captured.responseSchema);
});

test('rejects malformed provider summaries, unknown rows, bad requests, and missing configuration', async (t) => {
  const provider = await listen(t, createServer((_, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: '{"summary":""}' } }] }));
  }));
  const base = await listen(t, createApiServer(loadConfiguration({ OPENAI_BASE_URL: provider, OPENAI_MODEL: 'm' })));
  for (const [response, status, code] of [
    [await summarize(base), 502, 'INVALID_PROVIDER_RESPONSE'],
    [await summarize(base, { rowId: 'nope' }), 404, 'ROW_NOT_FOUND'],
    [await summarize(base, { rowId: 'order-001', row: { amount: 1 } }), 400, 'INVALID_REQUEST'],
  ] as const) {
    assert.equal(response.status, status);
    assert.equal(errorSchema.parse(await response.json()).error.code, code);
  }
  const unconfigured = await listen(t, createApiServer(loadConfiguration({})));
  const response = await summarize(unconfigured);
  assert.equal(response.status, 503);
  assert.equal(errorSchema.parse(await response.json()).error.code, 'AI_NOT_CONFIGURED');
});

test('order context is computed from the server dataset', () => {
  const context = buildOrderSummaryContext('order-001');
  assert.equal(context.record.id, 'order-001');
  assert.equal(context.related?.[0].facts.orderCount, 6);
  assert.throws(() => buildOrderSummaryContext('missing'), /does not exist/);
});

test('configuration validates provider kind and auth scheme', () => {
  assert.throws(() => loadConfiguration({ AI_PROVIDER: 'carrier-pigeon' }), /AI_PROVIDER/);
  assert.throws(() => loadConfiguration({ AI_AUTH_SCHEME: 'magic' }), /AI_AUTH_SCHEME/);
  const keyless = loadConfiguration({ OPENAI_BASE_URL: 'https://gateway.example/v1', OPENAI_MODEL: 'm', AI_AUTH_SCHEME: 'none' });
  assert.equal(keyless.ai?.authScheme, 'none');
});

test('demo provider summarizes and answers chat locally with no network or credentials', async (t) => {
  const base = await listen(t, createApiServer(loadConfiguration({ AI_PROVIDER: 'demo' })));
  const result = rowSummaryResponseSchema.parse(await (await summarize(base, { rowId: 'order-001' })).json());
  assert.match(result.summary, /order-001 for Contoso is Open in North America with an amount of \$125/);
  assert(result.highlights.length >= 2);
  assert.match(result.model, /demo/);
  const chat = await fetch(`${base}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promptId: 'custom', text: 'Summarize.', parameters: {}, context: { gridId: 'orders', selectedRowIds: ['order-001'] } }),
  });
  assert.equal(chat.status, 200);
  assert.match((await chat.json() as { answer: string }).answer, /Demo mode/);
});
