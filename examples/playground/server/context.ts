import type { ChatRequest, AssistantContext, Order } from '../shared/contracts.ts';
import { orders, prompts } from './data.ts';
import { ApiError } from './errors.ts';
import type { RowSummaryContext } from './summary.ts';

function totals(rows: readonly Order[]): AssistantContext['filtered'] {
  return {
    rowCount: rows.length,
    amount: rows.reduce((sum, order) => sum + order.amount, 0),
    openCount: rows.filter((order) => order.status === 'Open').length,
    onHoldCount: rows.filter((order) => order.status === 'On hold').length,
    shippedCount: rows.filter((order) => order.status === 'Shipped').length,
  };
}

export function validatePrompt(request: ChatRequest): void {
  if (request.promptId === 'custom') {
    if (Object.keys(request.parameters).length) {
      throw new ApiError(400, 'INVALID_PARAMETERS', 'Custom questions do not accept template parameters.');
    }
    return;
  }
  const prompt = prompts.find((entry) => entry.id === request.promptId);
  if (!prompt || request.text !== prompt.displayPrompt) {
    throw new ApiError(400, 'INVALID_PROMPT', 'Unknown or modified saved prompt. Reload the prompt library.');
  }
  const parameters = prompt.parameters ?? [];
  if (Object.keys(request.parameters).some((name) => !parameters.some((entry) => entry.name === name))) {
    throw new ApiError(400, 'INVALID_PARAMETERS', 'The prompt contains undeclared parameters.');
  }
  if (parameters.some((entry) => entry.required && !request.parameters[entry.name]?.trim())) {
    throw new ApiError(400, 'MISSING_PARAMETER', 'Complete every required prompt parameter.');
  }
}

export function buildOrderSummaryContext(rowId: string): RowSummaryContext {
  const order = orders.find((entry) => entry.id === rowId);
  if (!order) throw new ApiError(404, 'ROW_NOT_FOUND', 'That order does not exist in the local dataset.');
  const sameCustomer = orders.filter((entry) => entry.customer === order.customer);
  const sameRegion = orders.filter((entry) => entry.region === order.region);
  const average = (rows: readonly Order[]) => Math.round(rows.reduce((sum, entry) => sum + entry.amount, 0) / rows.length);
  const largerCount = orders.filter((entry) => entry.amount > order.amount).length;
  return {
    table: { name: 'Orders', recordName: 'order', description: 'fictional sales orders; amounts are in USD' },
    columns: [
      { id: 'id', label: 'Order', type: 'text' },
      { id: 'customer', label: 'Customer', type: 'text' },
      { id: 'status', label: 'Status', type: 'choice' },
      { id: 'region', label: 'Region', type: 'choice' },
      { id: 'amount', label: 'Amount', type: 'currency', unit: 'USD' },
    ],
    record: { id: order.id, values: { ...order } },
    related: [
      {
        label: `Orders from ${order.customer}`,
        facts: { orderCount: sameCustomer.length, totalAmountUsd: sameCustomer.reduce((sum, entry) => sum + entry.amount, 0),
          openCount: totals(sameCustomer).openCount, onHoldCount: totals(sameCustomer).onHoldCount },
      },
      {
        label: `Orders in ${order.region}`,
        facts: { orderCount: sameRegion.length, averageAmountUsd: average(sameRegion) },
      },
      {
        label: 'All orders',
        facts: { orderCount: orders.length, averageAmountUsd: average(orders), ordersWithLargerAmount: largerCount },
      },
    ],
  };
}

export function buildAssistantContext(request: ChatRequest): AssistantContext {
  const context = request.context;
  const ids = [...new Set(context.selectedRowIds)];
  if (ids.length !== context.selectedRowIds.length || ids.some((id) => !orders.some((order) => order.id === id))) {
    throw new ApiError(400, 'INVALID_SELECTION', 'Selection IDs must be unique IDs from the local order dataset.');
  }
  if (context.selectedRowCount !== undefined && context.selectedRowCount < ids.length) {
    throw new ApiError(400, 'INVALID_SELECTION', 'Selected row count cannot be smaller than the supplied selection.');
  }
  const filters = context.filters ?? {};
  const filtered = orders.filter((order) =>
    (!filters.status || order.status === filters.status)
    && (!filters.region || order.region === filters.region)
    && (!filters.customerSearch || order.customer.toLowerCase().includes(filters.customerSearch.toLowerCase()))
  );
  const selected = orders.filter((order) => ids.includes(order.id));
  const reportedSelectedCount = context.selectedRowCount ?? ids.length;
  return {
    gridId: 'orders',
    currency: 'USD',
    dataset: 'Fictional local orders',
    filters,
    sorting: context.sorting ?? [],
    selectedRowIds: ids,
    reportedSelectedCount,
    selectionTruncated: !!context.selectedRowIdsTruncated || reportedSelectedCount > ids.length,
    filtered: totals(filtered),
    includedSelection: totals(selected),
  };
}
