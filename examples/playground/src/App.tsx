import * as React from 'react';
import {
  Badge, Button, Field, FluentProvider, Input, Select, Spinner, Textarea,
  createTableColumn, webLightTheme,
} from '@fluentui/react-components';
import type { TableRowId } from '@fluentui/react-components';
import {
  DataGrid, DataGridBody, DataGridCell, DataGridHeader, DataGridHeaderCell, DataGridRow,
} from '@fluentui-contrib/react-data-grid-react-window';
import type { DataGridProps, RowRenderer } from '@fluentui-contrib/react-data-grid-react-window';
import { PromptSparksMenu } from '@fluentui-contrib/react-prompts';
import type { PromptContext, PromptDefinition, PromptSubmission } from '@fluentui-contrib/react-prompts';
import { z } from 'zod';
import {
  chatRequestSchema, chatResponseSchema, errorSchema, healthSchema, ordersSchema,
  promptsSchema, regionSchema, statusSchema,
} from '../shared/contracts';
import type { ChatRequest, ChatResponse, GridFilters, Health, Order } from '../shared/contracts';
import './App.css';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const columns = [
  createTableColumn<Order>({
    columnId: 'id', compare: (a, b) => a.id.localeCompare(b.id),
    renderHeaderCell: () => 'Order', renderCell: (order) => <span className="order-id">{order.id}</span>,
  }),
  createTableColumn<Order>({
    columnId: 'customer', compare: (a, b) => a.customer.localeCompare(b.customer),
    renderHeaderCell: () => 'Customer', renderCell: (order) => order.customer,
  }),
  createTableColumn<Order>({
    columnId: 'status', compare: (a, b) => a.status.localeCompare(b.status),
    renderHeaderCell: () => 'Status',
    renderCell: (order) => (
      <Badge appearance="tint" color={order.status === 'On hold' ? 'warning' : order.status === 'Shipped' ? 'success' : 'informative'}>
        {order.status}
      </Badge>
    ),
  }),
  createTableColumn<Order>({
    columnId: 'region', compare: (a, b) => a.region.localeCompare(b.region),
    renderHeaderCell: () => 'Region', renderCell: (order) => order.region,
  }),
  createTableColumn<Order>({
    columnId: 'amount', compare: (a, b) => a.amount - b.amount,
    renderHeaderCell: () => 'Amount', renderCell: (order) => money.format(order.amount),
  }),
];

const renderRow: RowRenderer<Order> = ({ item, rowId }, style) => (
  <DataGridRow<Order>
    key={rowId} style={style}
    selectionCell={{ checkboxIndicator: { 'aria-label': `Select ${item.id}` } }}
  >
    {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
  </DataGridRow>
);

async function api<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(`The API returned a non-JSON response (HTTP ${response.status}). Check that the backend is running.`);
  }
  if (!response.ok) {
    const failure = errorSchema.safeParse(body);
    throw new Error(failure.success ? failure.data.error.message : `API request failed (HTTP ${response.status}).`);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new Error('The API response did not match the expected contract. Check the backend version.');
  return parsed.data;
}

type Turn = {
  id: number;
  request: ChatRequest;
  response?: ChatResponse;
  error?: string;
};

function Playground(): React.ReactElement {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [prompts, setPrompts] = React.useState<PromptDefinition[]>([]);
  const [health, setHealth] = React.useState<Health>();
  const [loadError, setLoadError] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [reload, setReload] = React.useState(0);
  const [filters, setFilters] = React.useState<GridFilters>({});
  const [selectedItems, setSelectedItems] = React.useState<Set<TableRowId>>(new Set());
  const [sortState, setSortState] = React.useState<NonNullable<DataGridProps['sortState']>>({
    sortColumn: 'customer', sortDirection: 'ascending',
  });
  const [question, setQuestion] = React.useState('');
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState('');
  const submitting = React.useRef(false);
  const sequence = React.useRef(0);
  const controller = React.useRef<AbortController>();

  React.useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setLoadError('');
    void Promise.all([
      api('/api/orders', ordersSchema, { signal: abort.signal }),
      api('/api/prompts', promptsSchema, { signal: abort.signal }),
      api('/api/health', healthSchema, { signal: abort.signal }),
    ]).then(([rows, library, status]) => {
      if (abort.signal.aborted) return;
      setOrders(rows);
      setPrompts(library);
      setHealth(status);
    }).catch((error: unknown) => {
      if (!abort.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Unable to load the playground.');
    }).finally(() => {
      if (!abort.signal.aborted) setLoading(false);
    });
    return () => abort.abort();
  }, [reload]);

  React.useEffect(() => () => controller.current?.abort(), []);

  const visibleOrders = orders.filter((order) =>
    (!filters.status || order.status === filters.status)
    && (!filters.region || order.region === filters.region)
    && (!filters.customerSearch || order.customer.toLowerCase().includes(filters.customerSearch.toLowerCase())),
  );
  const selectedOrders = orders.filter((order) => selectedItems.has(order.id));
  const filteredAmount = visibleOrders.reduce((sum, order) => sum + order.amount, 0);
  const selectedAmount = selectedOrders.reduce((sum, order) => sum + order.amount, 0);
  const getContext = (): PromptContext => ({
    gridId: 'orders',
    selectedRowIds: Array.from(selectedItems).slice(0, 20),
    selectedRowCount: selectedItems.size,
    selectedRowIdsTruncated: selectedItems.size > 20,
    filters: { ...filters },
    sorting: sortState.sortColumn === undefined ? [] : [{
      columnId: String(sortState.sortColumn), direction: sortState.sortDirection,
    }],
    summaries: {
      filteredCount: visibleOrders.length, filteredAmount,
      selectedCount: selectedItems.size, selectedAmount,
    },
  });

  const submit = async (submission: PromptSubmission): Promise<void> => {
    if (submitting.current) throw new Error('An assistant request is already in progress.');
    submitting.current = true;
    setBusy(true);
    setSubmissionError('');
    const id = ++sequence.current;
    try {
      const request = chatRequestSchema.parse(submission);
      setTurns((current) => [...current, { id, request }]);
      controller.current = new AbortController();
      const response = await api('/api/chat', chatResponseSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.current.signal,
      });
      setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, response } : turn));
    } catch (error) {
      const message = error instanceof z.ZodError
        ? 'The prompt context is invalid. Reload the page and retry.'
        : error instanceof Error ? error.message : 'The assistant request failed.';
      setSubmissionError(message);
      setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, error: message } : turn));
      throw new Error(message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const latest = turns[turns.length - 1];
  return (
    <div className="lab-shell">
      <header className="masthead">
        <div className="brand-mark" aria-hidden="true">P</div>
        <div><p className="eyebrow">FLUENT UI CONTRIB / LOCAL PLAYGROUND</p><h1>Grid Prompt Lab</h1></div>
        <Badge appearance="tint" color={health?.configured ? 'success' : 'warning'}>
          {health?.configured ? 'Provider configured' : 'Provider setup needed'}
        </Badge>
      </header>
      <p className="intro">Explore your grid. Bring its context to the conversation.</p>

      {loading && <Spinner label="Loading grid and prompt library" />}
      {loadError && <div role="alert" className="notice error">{loadError} <Button onClick={() => setReload((value) => value + 1)}>Retry</Button></div>}
      {!loading && !loadError && health && (
        <div className={`notice ${health.configured ? 'connected' : ''}`}>
          <strong>{health.configured ? `Connected to ${health.providerHost} / ${health.model}` : 'Your grid is ready. Connect an AI provider to get answers.'}</strong>
          <span>{health.configured
            ? 'Requests use your configured endpoint. Each question is independent.'
            : `Set ${health.missing.join(', ')} in the backend .env file, restart the API, then refresh.`}</span>
          <Button size="small" onClick={() => setReload((value) => value + 1)}>Refresh connection</Button>
        </div>
      )}

      <main className="workspace">
        <section className="grid-workspace" aria-labelledby="orders-title">
          <div className="metrics">
            <div className="metric"><span>Orders in view</span><strong>{visibleOrders.length}<small> / {orders.length}</small></strong></div>
            <div className="metric"><span>View total · USD</span><strong>{money.format(filteredAmount)}</strong></div>
            <div className="metric accent"><span>Selected · {selectedItems.size} orders</span><strong>{money.format(selectedAmount)}</strong></div>
          </div>
          <div className="panel grid-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">WORKING DATASET</p><h2 id="orders-title">Orders overview</h2></div>
              <PromptSparksMenu prompts={prompts} getContext={getContext} onSubmit={submit}
                disabled={loading || !!loadError || busy} label="Prompt sparks" />
            </div>
            <div className="filter-bar">
              <Field label="Customer search">
                <Input value={filters.customerSearch ?? ''} placeholder="Find a customer"
                  onChange={(_, data) => setFilters((value) => ({ ...value, customerSearch: data.value || undefined }))} />
              </Field>
              <Field label="Status">
                <Select value={filters.status ?? ''} onChange={(event) => {
                  const value = event.target.value;
                  setFilters((current) => ({ ...current, status: value ? statusSchema.parse(value) : undefined }));
                }}>
                  <option value="">All statuses</option>
                  {statusSchema.options.map((status) => <option key={status}>{status}</option>)}
                </Select>
              </Field>
              <Field label="Region">
                <Select value={filters.region ?? ''} onChange={(event) => {
                  const value = event.target.value;
                  setFilters((current) => ({ ...current, region: value ? regionSchema.parse(value) : undefined }));
                }}>
                  <option value="">All regions</option>
                  {regionSchema.options.map((region) => <option key={region}>{region}</option>)}
                </Select>
              </Field>
              <Button appearance="subtle" onClick={() => setFilters({})}>Reset filters</Button>
            </div>
            <div className="grid-scroll">
              <DataGrid aria-label="Orders" items={visibleOrders} columns={columns}
                getRowId={(order: Order) => order.id} selectionMode="multiselect"
                selectedItems={selectedItems} onSelectionChange={(_, data) => setSelectedItems(new Set(data.selectedItems))}
                sortable sortState={sortState} onSortChange={(_, data) => setSortState(data)}>
                <DataGridHeader>
                  <DataGridRow selectionCell={{ checkboxIndicator: { 'aria-label': 'Select all visible orders' } }}>
                    {({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}
                  </DataGridRow>
                </DataGridHeader>
                <DataGridBody<Order> itemSize={52} height={364}>{renderRow}</DataGridBody>
              </DataGrid>
              {!visibleOrders.length && !loading && <p className="empty-grid">No orders match these filters.</p>}
            </div>
            <div className="grid-footer">
              <span>{selectedItems.size} selected across all filters</span>
              <Button size="small" appearance="subtle" disabled={!selectedItems.size} onClick={() => setSelectedItems(new Set())}>Clear selection</Button>
            </div>
          </div>
          <details className="panel inspector">
            <summary>Context inspector <span>IDs + summaries, never raw rows</span></summary>
            <p>Current browser context. The backend recomputes totals from its own dataset. Only the first 20 selected IDs are sent.</p>
            <pre data-testid="current-context">{JSON.stringify(getContext(), null, 2)}</pre>
            {latest && <>
              <h3>Last submitted request</h3>
              <pre data-testid="last-request">{JSON.stringify(latest.request, null, 2)}</pre>
              {latest.response && <><h3>Verified context sent to the provider</h3><pre>{JSON.stringify(latest.response.context, null, 2)}</pre></>}
            </>}
          </details>
          <p className="footnote">36 fictional orders · Actual Fluent UI Contrib components · Backend-owned provider credentials</p>
        </section>

        <aside className="panel assistant-panel" aria-labelledby="assistant-title">
          <div className="panel-heading"><div><p className="eyebrow">CONTEXT-AWARE WORKSPACE</p><h2 id="assistant-title">Ask your grid</h2></div><span className="sparkle" aria-hidden="true">✦</span></div>
          <div className="context-strip"><span className="context-dot" />Orders context attached <span>{selectedItems.size} selected</span></div>
          <div className="conversation" aria-live="polite" aria-busy={busy}>
            {!turns.length && <div className="assistant-empty">
              <span className="empty-sparkle" aria-hidden="true">✦</span>
              <h3>Start with a little context</h3>
              <p>Select orders or adjust a filter, then choose a prompt spark or ask a question below.</p>
              <div className="suggestions">
                {['Summarize the current order view.', 'What needs attention in this view?'].map((text) =>
                  <Button key={text} appearance="outline" onClick={() => setQuestion(text)}>{text}</Button>)}
              </div>
            </div>}
            {turns.map((turn) => <article className="turn" key={turn.id}>
              <div className="question"><span>YOU</span><p>{turn.request.text}</p>
                {Object.keys(turn.request.parameters).length > 0 && <p className="parameters">{Object.entries(turn.request.parameters).map(([name, value]) => `${name}: ${value}`).join(' · ')}</p>}
                <small>{turn.request.context.selectedRowCount ?? 0} selected · context captured at send time</small>
              </div>
              {turn.response && <div className="answer"><span>ASSISTANT · {turn.response.model}</span><p>{turn.response.answer}</p>
                {turn.response.warning && <p className="warning">{turn.response.warning}</p>}
              </div>}
              {turn.error && <div className="answer error"><span>REQUEST FAILED</span><p>{turn.error}</p></div>}
              {!turn.error && !turn.response && <Spinner size="small" label="Waiting for your AI provider" />}
            </article>)}
          </div>
          <form className="composer" onSubmit={(event) => {
            event.preventDefault();
            void submit({ promptId: 'custom', text: question.trim(), parameters: {}, context: getContext() })
              .then(() => setQuestion('')).catch(() => { /* The submission error is displayed below and in the conversation. */ });
          }}>
            <Field label="Your question">
              <Textarea value={question} disabled={busy} onChange={(_, data) => setQuestion(data.value)} resize="vertical"
                placeholder="What can you tell me about these orders?" maxLength={4000} />
            </Field>
            {submissionError && <p role="alert" className="composer-error">{submissionError}</p>}
            <div className="composer-footer"><span>New context with every question</span>
              <Button type="submit" appearance="primary" disabled={!question.trim() || busy || loading || !!loadError}>{busy ? 'Asking…' : 'Ask assistant'}</Button>
            </div>
            <p className="privacy-note">Sends the question, selected IDs, filters, sorting, and server-verified aggregates to your configured provider. No conversation history or raw rows.</p>
          </form>
        </aside>
      </main>
    </div>
  );
}

export default function App(): React.ReactElement {
  return <FluentProvider theme={webLightTheme}><Playground /></FluentProvider>;
}
