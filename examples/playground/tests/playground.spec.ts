import { expect, test } from '@playwright/test';
import type { ChatResponse } from '../shared/contracts';

test('loads the real grid and captures filtered, selected, and sorted context', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Grid Prompt Lab' })).toBeVisible();
  await expect(page.getByRole('grid', { name: 'Orders' })).toBeVisible();
  await expect(page.getByText('Loading grid and prompt library')).not.toBeVisible();
  await page.getByLabel('Customer search', { exact: true }).fill('Contoso');
  await page.getByLabel('Status', { exact: true }).selectOption('Open');
  await page.getByRole('checkbox', { name: 'Select order-001', exact: true }).check();
  await page.getByRole('columnheader', { name: 'Amount' }).click();
  await page.getByText('Context inspector', { exact: false }).click();
  const current = page.getByTestId('current-context');
  await expect(current).toContainText('"customerSearch": "Contoso"');
  await expect(current).toContainText('"status": "Open"');
  await expect(current).toContainText('"order-001"');
  await expect(current).toContainText('"columnId": "amount"');
  expect(consoleErrors).toEqual([]);
});

test('caps select-all context at twenty IDs while preserving full selection count', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('checkbox', { name: 'Select all visible orders', exact: true }).check();
  await page.getByText('Context inspector', { exact: false }).click();
  const context = JSON.parse(await page.getByTestId('current-context').innerText());
  expect(context.selectedRowIds).toHaveLength(20);
  expect(context.selectedRowCount).toBe(36);
  expect(context.selectedRowIdsTruncated).toBe(true);
});

test('submits a real API request and visibly reports missing provider configuration', async ({ page, request }) => {
  const health = await (await request.get('/api/health')).json();
  test.skip(health.configured, 'This test intentionally checks the unconfigured-provider state.');
  await page.goto('/');
  await expect(page.getByText('Your grid is ready. Connect an AI provider to get answers.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Your question', exact: true }).fill('Summarize this view.');
  const response = page.waitForResponse((response) => response.url().endsWith('/api/chat') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Ask assistant', exact: true }).click();
  expect((await response).status()).toBe(503);
  await expect(page.getByRole('alert')).toContainText('Configure');
  await expect(page.getByText('REQUEST FAILED', { exact: true })).toBeVisible();
  await page.getByText('Context inspector', { exact: false }).click();
  const sent = JSON.parse(await page.getByTestId('last-request').innerText());
  expect(sent.promptId).toBe('custom');
  expect(sent.context.gridId).toBe('orders');
  expect(sent.context).not.toHaveProperty('rows');
});

test('opens the actual prompt gallery and preserves it when submission fails', async ({ page, request }) => {
  const health = await (await request.get('/api/health')).json();
  test.skip(health.configured, 'This test intentionally checks the unconfigured-provider state.');
  await page.goto('/');
  await page.getByRole('button', { name: 'Prompt sparks' }).click();
  await page.getByRole('menuitem', { name: /gallery/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Search prompts', exact: true }).fill('audience');
  await dialog.getByRole('button', { name: 'Summarize the current order view for {Audience}.', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Send Prompt' })).toBeDisabled();
  await dialog.getByRole('textbox', { name: 'Audience', exact: true }).fill('Operations team');
  await dialog.getByRole('button', { name: /send|submit/i }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText('Configure');
});

test('remains usable at a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ask your grid' })).toBeVisible();
  const width = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(width.content).toBeLessThanOrEqual(width.viewport);
});

test('renders a clearly labeled test-fixture answer and preserves its context snapshot', async ({ page }) => {
  const fixture: ChatResponse = {
    id: 'test-fixture',
    answer: 'Browser test fixture: the included selection contains one order totaling USD 125.',
    model: 'test-fixture-not-a-live-provider',
    context: {
      gridId: 'orders', currency: 'USD', dataset: 'Fictional local orders',
      selectedRowIds: ['order-001'], reportedSelectedCount: 1, selectionTruncated: false,
      filters: { customerSearch: 'Contoso', status: 'Open' }, sorting: [{ columnId: 'customer', direction: 'ascending' }],
      filtered: { rowCount: 2, amount: 316, openCount: 2, onHoldCount: 0, shippedCount: 0 },
      includedSelection: { rowCount: 1, amount: 125, openCount: 1, onHoldCount: 0, shippedCount: 0 },
    },
  };
  await page.route('**/api/chat', async (route) => {
    const sent = route.request().postDataJSON();
    expect(sent.context.selectedRowIds).toEqual(['order-001']);
    expect(sent.context.filters.status).toBe('Open');
    await route.fulfill({ json: fixture });
  });
  await page.goto('/');
  await page.getByLabel('Customer search', { exact: true }).fill('Contoso');
  await page.getByLabel('Status', { exact: true }).selectOption('Open');
  await page.getByRole('checkbox', { name: 'Select order-001', exact: true }).check();
  await page.getByRole('textbox', { name: 'Your question', exact: true }).fill('Summarize my selection.');
  await page.getByRole('button', { name: 'Ask assistant', exact: true }).click();
  await expect(page.getByText(fixture.answer, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await page.getByText('Context inspector', { exact: false }).click();
  const sent = JSON.parse(await page.getByTestId('last-request').innerText());
  expect(sent.context.filters.status).toBe('Open');
  expect(sent.context.selectedRowIds).toEqual(['order-001']);
  const current = JSON.parse(await page.getByTestId('current-context').innerText());
  expect(current.selectedRowCount).toBe(0);
  expect(current.filters).toEqual({});
});

test('opens a row summary from the grid, then refreshes and reports provider errors', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/summary', async (route) => {
    calls += 1;
    expect(route.request().postDataJSON()).toEqual({ rowId: 'order-001' });
    if (calls === 2) {
      await route.fulfill({ status: 502, json: { error: { code: 'PROVIDER_REJECTED', message: 'Browser fixture: provider rejected the request.' } } });
      return;
    }
    await route.fulfill({
      json: {
        id: `test-fixture-${calls}`, rowId: 'order-001', model: 'test-fixture-not-a-live-provider',
        summary: 'Browser test fixture summary for order-001.', highlights: ['Fixture highlight'],
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Summarize order-001', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Browser test fixture summary for order-001.')).toBeVisible();
  await expect(dialog.getByText('Fixture highlight')).toBeVisible();
  await dialog.getByRole('button', { name: 'Refresh' }).click();
  await expect(dialog.getByRole('alert')).toContainText('provider rejected');
  await dialog.getByRole('button', { name: 'Refresh' }).click();
  await expect(dialog.getByTestId('row-summary')).toBeVisible();
  await dialog.getByRole('button', { name: 'Good summary' }).click();
  await expect(dialog.getByRole('button', { name: 'Good summary' })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('0 selected across all filters')).toBeVisible();
});
