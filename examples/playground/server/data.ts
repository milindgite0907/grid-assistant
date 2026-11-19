import type { PromptDefinition } from '@fluentui-contrib/react-prompts';
import type { Order } from '../shared/contracts.ts';

const customers = ['Contoso', 'Fabrikam', 'Northwind', 'Adventure Works', 'Woodgrove', 'Tailspin'];
const statuses: Order['status'][] = ['Open', 'Shipped', 'On hold'];
const regions: Order['region'][] = ['North America', 'Europe', 'Asia Pacific'];

export const orders: Order[] = Array.from({ length: 36 }, (_, index) => ({
  id: `order-${String(index + 1).padStart(3, '0')}`,
  customer: customers[index % customers.length],
  status: statuses[Math.floor(index / 3) % statuses.length],
  region: regions[index % regions.length],
  amount: 125 + ((index * 137) % 2400),
}));

export const prompts: PromptDefinition[] = [
  {
    id: 'selection-summary',
    displayPrompt: 'Summarize the selected orders using only the supplied selection summaries.',
    shortPrompt: 'Summarize selection',
    showInSparks: true,
    sparksGroup: 'Selection',
  },
  {
    id: 'filter-summary',
    displayPrompt: 'Explain the active filters, sort order, and filtered order totals.',
    shortPrompt: 'Explain this view',
    showInSparks: true,
    sparksGroup: 'Current view',
  },
  {
    id: 'attention',
    displayPrompt: 'What needs attention in this order view based on open and on-hold counts?',
    shortPrompt: 'What needs attention?',
    showInSparks: true,
    sparksGroup: 'Current view',
  },
  {
    id: 'audience-summary',
    displayPrompt: 'Summarize the current order view for {Audience}.',
    shortPrompt: 'Audience summary',
    executePrompt: 'Create a tailored business summary of the filtered grid aggregates.',
    parameters: [{ name: 'Audience', label: 'Audience', placeholder: 'For example, Operations team', required: true }],
  },
  {
    id: 'selection-compare',
    displayPrompt: 'Compare the included selection totals with the filtered view totals.',
  },
  {
    id: 'follow-up',
    displayPrompt: 'Suggest follow-up actions for {Team} using only the current view summaries.',
    parameters: [
      { name: 'Team', label: 'Team', required: true },
      { name: 'Focus', label: 'Optional focus', placeholder: 'For example, blocked orders' },
    ],
  },
];
