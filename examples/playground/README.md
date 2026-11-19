# Grid Prompt Lab

A React example for trying the **actual** Fluent UI Contrib virtualized DataGrid and the local Prompt Sparks / Prompt Gallery package against a live, application-owned backend.

## Run locally

Requires Node **22.18+** (or Node 24+) and npm. Install and build from the repository root:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run dev
```

Open **http://127.0.0.1:5187**. The API listens on **http://127.0.0.1:3017**. Both bind to loopback only. Stop both with Ctrl+C. These ports allow the original playground to continue running separately.

The grid, selection, filtering, sorting, gallery, and context inspector work immediately with 36 fictional orders. With no provider configured, AI requests return a visible `503 AI_NOT_CONFIGURED`; nothing is fabricated. For a no-account demo, run `npm.cmd run demo` from the repository root: it starts the same servers with `AI_PROVIDER=demo`, a clearly labeled local rule-based responder (`demo-rules`) that restates the supplied context and never contacts a service.

## Configure a real AI provider

From this example's directory (`examples/playground`), copy the safe template, then edit `.env` locally:

```powershell
Copy-Item .env.example .env
```

```dotenv
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=your-available-chat-model
OPENAI_API_KEY=your-key
OPENAI_TIMEOUT_MS=45000
OPENAI_MAX_TOKENS=1200
```

Restart the API after changing `.env`, then click **Refresh connection**. Do not paste credentials into chat or put them in `VITE_*` variables. `.env` is ignored by git. Credentials are used only by the backend and are not returned by health or chat APIs.

The endpoint must support OpenAI-compatible `POST <base-url>/chat/completions` with `model`, `max_tokens`, and `messages`, returning `choices[0].message.content` as nonempty text. Use a model that supports these fields. This is not an Azure deployment-specific API adapter.

For a compatible local server:

```dotenv
OPENAI_BASE_URL=http://127.0.0.1:1234/v1
OPENAI_MODEL=your-loaded-model
OPENAI_API_KEY=
```

API keys are optional only for loopback endpoints. Remote endpoints require HTTPS and a key. Model access, billing, network access, and provider quota remain your responsibility. A configured health indicator checks settings, not provider connectivity; submitting a question verifies the actual provider call.

## Row summaries (any AI provider)

Each grid row has a **Summary** action, modeled on Power Apps
[row summaries](https://learn.microsoft.com/en-us/power-apps/user/record-summaries). It opens a dialog with an AI summary (paragraph plus bullets), **Copy**, **Refresh**, and feedback.

The backend is provider-neutral: **JSON prompt in, JSON out**.

1. `POST /api/summary` takes only `{ "rowId": "order-001" }`.
2. The server builds a `RowSummaryContext` (table, column metadata, the record, and server-computed related facts) from its own data. [server/summary.ts](server/summary.ts) generates the **entire prompt from that context**; no prompt text comes from a config file, environment variable, or the browser.
3. The prompt goes to the configured provider, which must answer with `{ "summary": string, "highlights": string[] }`. The reply is validated before it reaches the UI. Fenced or prose-wrapped JSON is tolerated.

Choose the provider with `AI_PROVIDER` in `.env`. Only connection settings are configuration.

| Target | `AI_PROVIDER` | `OPENAI_BASE_URL` | `AI_AUTH_SCHEME` |
|---|---|---|---|
| OpenAI | `openai-compatible` | `https://api.openai.com/v1` | `bearer` |
| Azure AI Foundry / Azure OpenAI (v1 API) | `openai-compatible` | `https://<resource>.openai.azure.com/openai/v1` | `bearer` (Entra token) or `api-key` |
| GitHub Models | `openai-compatible` | `https://models.github.ai/inference` | `bearer` |
| Local (Ollama, LM Studio, vLLM) | `openai-compatible` | `http://127.0.0.1:11434/v1` | `none` |
| Copilot or any custom gateway | `json-http` | the gateway URL | `bearer`, `api-key`, or `none` |
| Offline demo (no model) | `demo` | not used | not used |

`OPENAI_MODEL` is the model or deployment name sent to the provider. With `openai-compatible`, requests use `response_format: json_object` and retry once without it if a server rejects the field. With `json-http`, the server POSTs
`{ "task", "model", "maxTokens", "messages", "responseSchema" }` to the URL as-is and expects the JSON answer as the response body (`task` is `row-summary` or `chat`; chat replies use `{ "answer": string }`). A Copilot-backed service can sit behind such a gateway.

Row summaries send the selected record's field values and a few computed aggregates to the provider, unlike chat, which sends only aggregates. Review your provider's data policy first. Feedback (thumbs) is not persisted by the example.

## Try it

1. Select one or more orders.
2. Search by customer, filter by status or region, and sort a column.
3. Use **Prompt sparks** for quick prompts or open the gallery for parameterized prompts.
4. Alternatively, ask a free-text question in **Ask your grid**.
5. Expand **Context inspector** to see current browser context, the last submitted request, and the backend-verified context after a successful answer.

Selection persists across filters. At most **20 selected IDs** are sent, with the full reported count and truncation metadata. The browser shows full-selection totals locally; the backend ignores these claimed totals and recomputes aggregates from its dataset. Included-selection totals cover only supplied IDs, not omitted selections. Reported selection counts are caller-reported, not independently verified.

Each question is **single-turn**. Earlier answers remain visible locally but are not sent as conversation history. Turn snapshots do not change when the grid changes. A failed gallery submission remains open with an explicit error.

## What goes to the provider?

- Row summaries: the one requested record's values plus server-computed customer, region, and overall aggregates (see above).
- Chat, below, never includes raw rows:

- Question and declared template parameter values.
- Selected IDs, filters, sorting, and selection-truncation metadata.
- Server-computed filtered and included-selection aggregates: counts, status counts, and USD totals.
- Instructions explaining data limits.

**No raw rows or previous conversation turns** are sent. Filter values and questions can still contain sensitive text: review your configured provider's data policy before replacing the fictional dataset. This app deliberately cannot answer questions requiring individual record details beyond supplied IDs or aggregates, and cannot modify orders.

## Project layout

- [src/App.tsx](src/App.tsx): grid, prompt callback, custom composer, response display, and inspector.
- [shared/contracts.ts](shared/contracts.ts): runtime API validation and shared types.
- [server/data.ts](server/data.ts): fictional orders and prompt library.
- [server/context.ts](server/context.ts): prompt validation and authoritative summaries.
- [server/assistant.ts](server/assistant.ts): chat call.
- [server/provider.ts](server/provider.ts): provider adapters (OpenAI-compatible and JSON-over-HTTP).
- [server/demo.ts](server/demo.ts): the offline demo responder.
- [server/summary.ts](server/summary.ts): context-to-prompt builder and row-summary runner.
- [server/config.ts](server/config.ts): environment validation.
- [server/app.ts](server/app.ts): local HTTP API.
- [prompt component source](../../packages/react-prompts/src/): the editable local package used by this example.
- [vendor/](../../vendor/): installable snapshot of the virtualized grid dependency.

### API

| Route | Purpose |
|---|---|
| `GET /api/health` | Configuration status, model, provider hostname, missing setting names; never secrets |
| `GET /api/orders` | Fictional grid dataset |
| `GET /api/prompts` | Saved prompt definitions |
| `POST /api/chat` | Validate request, recompute context, invoke the configured provider |
| `POST /api/summary` | Build a context-derived prompt for one row, return `{ summary, highlights }` |

Errors use `{ "error": { "code": "...", "message": "..." } }`. Request bodies are limited to 64 KiB; the backend allows two active provider requests. Upstream error bodies are not exposed.

## Customize

Change orders and saved prompts in [server/data.ts](server/data.ts). Keep the shared schemas and grid columns consistent when adding fields. Parameter names must match the prompt definitions; the backend validates them. To add new context information, update the schema, browser context callback, server computation, and provider instructions together.

### Edit the local component

Edit `packages/react-prompts/src` from the repository root while `npm.cmd run dev`
is running. Vite resolves `@fluentui-contrib/react-prompts` directly to that source
and hot-reloads changes. There is no prompt tarball or dependency on the original
Fluent UI Contrib checkout. The grid dependency remains a vendored snapshot.

## Validate

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e
```

Run these commands from the repository root to cover both the package and example. Browser tests need Playwright Chromium installed (`npx.cmd playwright install chromium` if missing). Backend tests use a **local test-only provider stub**, never an external AI service. Browser tests exercise the real app and API; one explicitly labeled response fixture checks successful answer rendering and immutable context snapshots. Missing-configuration checks skip when you have configured a provider. Run these tests without provider configuration for full deterministic coverage. Browser tests do not submit requests to a configured external provider. Stop the example dev servers before running end-to-end tests; the tests start their own servers.

For a production-build local preview, run `npm.cmd run start:api` and `npm.cmd run preview` in separate terminals from this example's directory.

## Local development only

This is not production-ready authenticated infrastructure. It binds to loopback and checks browser Origin/Host headers, but **has no user authentication or authorization**. Local processes can access it. Before exposing it, add real identity and per-user data authorization, appropriate CSRF protection, durable rate limits, audit logging, deployment secret management, and production hosting. Prompt instructions are not a security boundary.
