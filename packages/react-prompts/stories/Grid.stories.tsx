import * as React from 'react';
import {
  Button,
  Field,
  Select,
  Toolbar,
  createTableColumn,
} from '@fluentui/react-components';
import type { JSXElement, TableRowId } from '@fluentui/react-components';
import {
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
} from '@fluentui-contrib/react-data-grid-react-window';
import type {
  DataGridProps,
  RowRenderer,
} from '@fluentui-contrib/react-data-grid-react-window';
import { PromptSparksMenu } from '../src';
import type { PromptContext, PromptSubmission } from '../src';
import { prompts } from './prompts';

type Order = {
  id: string;
  customer: string;
  status: string;
  amount: number;
};

const orders: Order[] = [
  { id: '100', customer: 'Contoso', status: 'Open', amount: 120 },
  { id: '101', customer: 'Fabrikam', status: 'Closed', amount: 350 },
  { id: '102', customer: 'Northwind', status: 'Open', amount: 240 },
];

const columns = [
  createTableColumn<Order>({
    columnId: 'customer',
    compare: (a, b) => a.customer.localeCompare(b.customer),
    renderHeaderCell: () => 'Customer',
    renderCell: (order) => order.customer,
  }),
  createTableColumn<Order>({
    columnId: 'status',
    compare: (a, b) => a.status.localeCompare(b.status),
    renderHeaderCell: () => 'Status',
    renderCell: (order) => order.status,
  }),
  createTableColumn<Order>({
    columnId: 'amount',
    compare: (a, b) => a.amount - b.amount,
    renderHeaderCell: () => 'Amount',
    renderCell: (order) => order.amount,
  }),
];

const renderRow: RowRenderer<Order> = ({ item, rowId }, style) => (
  <DataGridRow<Order> key={rowId} style={style}>
    {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
  </DataGridRow>
);

export function Grid(): JSXElement {
  const [selectedItems, setSelectedItems] = React.useState<Set<TableRowId>>(
    new Set()
  );
  const [status, setStatus] = React.useState('All');
  const [sortState, setSortState] = React.useState<
    NonNullable<DataGridProps['sortState']>
  >({
    sortColumn: 'customer',
    sortDirection: 'ascending',
  });
  const [request, setRequest] = React.useState<PromptSubmission>();
  const [chatOpen, setChatOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const visibleOrders = orders.filter(
    (order) => status === 'All' || order.status === status
  );
  const selectedOrders = orders.filter((order) => selectedItems.has(order.id));

  return (
    <>
      <Toolbar aria-label="Order actions">
        <PromptSparksMenu
          prompts={prompts}
          disabled={busy}
          getContext={(): PromptContext => ({
            gridId: 'orders',
            selectedRowIds: Array.from(selectedItems),
            filters: status === 'All' ? {} : { status },
            sorting:
              sortState.sortColumn !== undefined
                ? [
                    {
                      columnId: String(sortState.sortColumn),
                      direction: sortState.sortDirection,
                    },
                  ]
                : [],
            summaries: {
              selectedCount: selectedItems.size,
              selectedAmount: selectedOrders.reduce(
                (sum, order) => sum + order.amount,
                0
              ),
              filteredCount: visibleOrders.length,
              filteredAmount: visibleOrders.reduce(
                (sum, order) => sum + order.amount,
                0
              ),
            },
            parameterValues: { Audience: 'Operations team' },
          })}
          onSubmit={(submission) => {
            setChatOpen(true);
            setRequest(submission);
          }}
        />
        <Button onClick={() => setBusy((value) => !value)}>
          {busy ? 'Make assistant available' : 'Simulate busy assistant'}
        </Button>
      </Toolbar>
      <Field label="Status filter">
        <Select value={status} onChange={(_, data) => setStatus(data.value)}>
          <option>All</option>
          <option>Open</option>
          <option>Closed</option>
        </Select>
      </Field>
      <DataGrid
        aria-label="Orders"
        items={visibleOrders}
        columns={columns}
        getRowId={(order: Order) => order.id}
        selectionMode="multiselect"
        selectedItems={selectedItems}
        onSelectionChange={(_, data) => setSelectedItems(data.selectedItems)}
        sortable
        sortState={sortState}
        onSortChange={(_, data) => setSortState(data)}
      >
        <DataGridHeader>
          <DataGridRow>
            {({ renderHeaderCell }) => (
              <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
            )}
          </DataGridRow>
        </DataGridHeader>
        <DataGridBody<Order> itemSize={44} height={180}>
          {renderRow}
        </DataGridBody>
      </DataGrid>
      {chatOpen && (
        <section aria-label="Assistant integration example">
          <h3>Request for your assistant</h3>
          <p>
            This example displays the request, not an AI-generated answer.
            Replace the callback with your authorized assistant backend.
          </p>
          <pre>{JSON.stringify(request, null, 2)}</pre>
        </section>
      )}
    </>
  );
}
