import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { chatRequestSchema, rowSummaryRequestSchema } from '../shared/contracts.ts';
import type { AiConfig, Configuration } from './config.ts';
import { orders, prompts } from './data.ts';
import { ApiError } from './errors.ts';
import { buildAssistantContext, buildOrderSummaryContext, validatePrompt } from './context.ts';
import { askAssistant } from './assistant.ts';
import { summarizeRow } from './summary.ts';

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new ApiError(415, 'JSON_REQUIRED', 'Send the request as application/json.');
  }
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    const buffer: Buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 65_536) {
      request.resume();
      throw new ApiError(413, 'REQUEST_TOO_LARGE', 'Requests are limited to 64 KiB.');
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }
}

export function createApiServer(configuration: Configuration): Server {
  let activeRequests = 0;
  const withSlot = async <T>(work: () => Promise<T>): Promise<T> => {
    if (activeRequests >= 2) {
      throw new ApiError(429, 'ASSISTANT_BUSY', 'The local assistant already has two active requests. Please retry.');
    }
    activeRequests += 1;
    try {
      return await work();
    } finally {
      activeRequests -= 1;
    }
  };
  const requireAi = (config: Configuration): AiConfig => {
    if (!config.ai) {
      throw new ApiError(503, 'AI_NOT_CONFIGURED', `Configure ${config.missing.join(', ')} in the backend .env file, then restart the backend.`);
    }
    return config.ai;
  };
  return createServer({ headersTimeout: 10_000, requestTimeout: 15_000 }, (request, response) => {
    const controller = new AbortController();
    response.on('close', () => controller.abort());
    void (async () => {
      const origin = request.headers.origin;
      if (origin && !['http://127.0.0.1:5187', 'http://localhost:5187'].includes(origin)) {
        throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'This local API accepts requests only from the playground.');
      }
      const localPort = request.socket.localPort;
      if (![`127.0.0.1:${localPort}`, `localhost:${localPort}`, `[::1]:${localPort}`].includes(request.headers.host ?? '')) {
        throw new ApiError(403, 'HOST_NOT_ALLOWED', 'Use the loopback address to access this local API.');
      }
      const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
      if (request.method === 'GET' && path === '/api/health') {
        json(response, 200, {
          status: 'ok',
          configured: !!configuration.ai,
          model: configuration.model,
          provider: configuration.provider,
          providerHost: configuration.providerHost,
          missing: configuration.missing,
        });
      } else if (request.method === 'GET' && path === '/api/orders') {
        json(response, 200, orders);
      } else if (request.method === 'GET' && path === '/api/prompts') {
        json(response, 200, prompts);
      } else if (request.method === 'POST' && path === '/api/summary') {
        const parsed = rowSummaryRequestSchema.safeParse(await readJson(request));
        if (!parsed.success) {
          throw new ApiError(400, 'INVALID_REQUEST', parsed.error.issues.map((issue) =>
            `${issue.path.join('.') || 'request'}: ${issue.message}`).join('; '));
        }
        const summaryContext = buildOrderSummaryContext(parsed.data.rowId);
        const ai = requireAi(configuration);
        const result = await withSlot(() => summarizeRow(ai, summaryContext, controller.signal));
        if (!response.destroyed) {
          json(response, 200, { id: randomUUID(), rowId: parsed.data.rowId, ...result, model: ai.model });
        }
      } else if (request.method === 'POST' && path === '/api/chat') {
        const parsed = chatRequestSchema.safeParse(await readJson(request));
        if (!parsed.success) {
          throw new ApiError(400, 'INVALID_REQUEST', parsed.error.issues.map((issue) =>
            `${issue.path.join('.') || 'request'}: ${issue.message}`).join('; '));
        }
        validatePrompt(parsed.data);
        const context = buildAssistantContext(parsed.data);
        const ai = requireAi(configuration);
        const result = await withSlot(() => askAssistant(ai, parsed.data, context, controller.signal));
        if (!response.destroyed) {
          json(response, 200, { id: randomUUID(), ...result, context, model: ai.model });
        }
      } else {
        throw new ApiError(404, 'NOT_FOUND', 'API route not found.');
      }
    })().catch((error: unknown) => {
      const failure = error instanceof ApiError
        ? error
        : new ApiError(500, 'INTERNAL_ERROR', 'The backend could not complete the request.');
      console.error(`[api] ${failure.status} ${failure.code}: ${failure.message}`);
      if (!response.destroyed && !response.headersSent) {
        json(response, failure.status, { error: { code: failure.code, message: failure.message } });
      }
    });
  });
}
