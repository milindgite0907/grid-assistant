import type { PromptDefinition } from '../src';

export const prompts: PromptDefinition[] = [
  {
    id: 'selection',
    displayPrompt: 'Summarize the selected orders using the provided totals.',
    shortPrompt: 'Summarize selection',
    showInSparks: true,
    sparksGroup: 'Orders',
  },
  {
    id: 'filters',
    displayPrompt: 'Explain the active filters and sort order.',
    shortPrompt: 'Explain filters',
    showInSparks: true,
    sparksGroup: 'Orders',
  },
  {
    id: 'audience',
    displayPrompt: 'Summarize the order totals for {Audience}.',
    shortPrompt: 'Audience summary',
    executePrompt: 'Explain revenue and selection aggregates',
    parameters: [
      {
        name: 'Audience',
        label: 'Audience',
        placeholder: 'For example, Operations',
        required: true,
      },
      { name: 'Note', label: 'Optional note' },
    ],
  },
  {
    id: 'overview',
    displayPrompt: 'Describe the grid using the supplied summaries.',
  },
];
