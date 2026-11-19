import * as React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import {
  GalleryExample,
  GridExample,
} from './PromptSparksMenuExample.component-browser-spec';

test('parameter forms remain accessible at the bottom of a narrow, scrolling gallery', async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 420, height: 600 });
  await mount(<GalleryExample />);
  const prompt = page.getByRole('button', { name: 'Analyze {Audience}' });
  await prompt.scrollIntoViewIfNeeded();
  await prompt.focus();
  await page.keyboard.press('Enter');
  const input = page.getByRole('textbox', { name: 'Audience' });
  await expect(input).toBeFocused();
  const send = page.getByRole('button', { name: 'Send Prompt' });
  await expect(send).toBeDisabled();
  await input.pressSequentially('Operations team');
  await expect(page.getByRole('status', { name: 'Prompt preview' })).toHaveText(
    'Analyze Operations team'
  );
  await expect(send).toBeEnabled();
  const bounds = await send.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  });
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(420);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(600);
  await send.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('request')).toContainText(
    '"parameters":{"Audience":"Operations team"}'
  );
});

test('Fluent grid selection and filters appear in structured submission context', async ({
  mount,
  page,
}) => {
  await mount(<GridExample />);
  const row = page.getByRole('row').filter({ hasText: 'Contoso' });
  await row.click();
  await expect(row).toHaveAttribute('aria-selected', 'true');
  await page
    .getByRole('combobox', { name: 'Status filter' })
    .selectOption('Open');
  await page.getByRole('button', { name: 'Prompts', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Summarize selection' }).click();
  const request = page.getByRole('region', {
    name: 'Assistant integration example',
  });

  await expect(request).toContainText('"selectedRowIds": [\n      "100"');
  await expect(request).toContainText('"status": "Open"');
  await expect(request).toContainText('"selectedAmount": 120');
  await expect(request).not.toContainText('"customer":');
});

test('context failures remain visible and do not dismiss the gallery', async ({
  mount,
  page,
}) => {
  await mount(<GalleryExample contextError />);
  await page.getByRole('button', { name: 'Analyze {Audience}' }).click();
  await expect(page.getByRole('alert')).toHaveText('Context unavailable');
  await page
    .getByRole('button', { name: 'Describe summary 0', exact: true })
    .click();
  await expect(page.getByRole('alert')).toHaveText('Context unavailable');
  await expect(page.getByRole('dialog')).toBeVisible();
});
