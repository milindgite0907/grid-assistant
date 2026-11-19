import {
  buildPromptMessage,
  createPromptSubmission,
  formatPromptPreview,
  getParameterValues,
  groupSparksPrompts,
  hasRequiredParameters,
  searchPrompts,
  validatePrompts,
} from './promptUtils';
import type { PromptDefinition } from './types';

const prompt: PromptDefinition = {
  id: 'summarize',
  displayPrompt: 'Summarize {Customer}, {{customer}} and [CUSTOMER].',
  shortPrompt: 'Summary',
  executePrompt: 'Internal analysis instructions',
  parameters: [
    { name: 'Customer', label: 'Customer name', required: true },
    { name: 'Note', label: 'Optional note' },
  ],
};

describe('prompt utilities', () => {
  it('groups only Sparks prompts and falls back to Other', () => {
    const groups = groupSparksPrompts([
      prompt,
      { ...prompt, id: 'a', showInSparks: true, sparksGroup: ' Orders ' },
      { ...prompt, id: 'b', showInSparks: true, sparksGroup: ' ' },
      { ...prompt, id: 'c', showInSparks: true, sparksGroup: 'Orders' },
    ]);
    expect(Array.from(groups.keys())).toEqual(['Orders', 'Other']);
    expect(groups.get('Orders')?.map(({ id }) => id)).toEqual(['a', 'c']);
  });

  it.each(['customer', 'SUMMARY', 'internal ANALYSIS', '   '])(
    'searches all three text fields with query %s',
    (query) => {
      expect(searchPrompts([prompt], query)).toEqual([prompt]);
    }
  );

  it('returns no matches for unrelated search text', () => {
    expect(searchPrompts([prompt], 'missing')).toEqual([]);
  });

  it('substitutes all placeholder formats without altering the source text', () => {
    expect(formatPromptPreview(prompt, { Customer: 'Contoso' })).toBe(
      'Summarize Contoso, Contoso and Contoso.'
    );
    expect(formatPromptPreview(prompt)).toBe(
      'Summarize [Customer name], [Customer name] and [Customer name].'
    );
    expect(prompt.displayPrompt).toContain('{Customer}');
  });

  it('matches complete literal names and never substitutes inside values', () => {
    const special: PromptDefinition = {
      id: 'special',
      displayPrompt: '{a} {{a.b}} [a] {unknown}',
      parameters: [
        { name: 'a', label: 'A' },
        { name: 'a.b', label: 'B' },
      ],
    };
    expect(formatPromptPreview(special, { a: '{a.b}', 'a.b': '$&' })).toBe(
      '{a.b} $& {a.b} {unknown}'
    );
  });

  it('prefills declared parameters and gives user edits precedence', () => {
    expect(
      getParameterValues(
        prompt,
        { parameterValues: { Customer: 'Context', Secret: 'excluded' } },
        { Customer: 'User', Extra: 'excluded' }
      )
    ).toEqual({ Customer: 'User', Note: '' });
  });

  it('enforces required values including whitespace-only edits', () => {
    expect(hasRequiredParameters(prompt, { Customer: '   ' })).toBe(false);
    expect(hasRequiredParameters(prompt, { Customer: 'Contoso' })).toBe(true);
    expect(() => createPromptSubmission(prompt)).toThrow('required');
  });

  it('keeps context structured and sends raw display text, not execute text', () => {
    const context = {
      gridId: 'orders',
      selectedRowIds: [1, 2],
      filters: { status: 'Open' },
      sorting: [{ columnId: 'amount', direction: 'descending' as const }],
      summaries: { selectedCount: 2 },
      parameterValues: { Customer: 'Latest', Note: '  ', Extra: 'ignored' },
    };
    const request = createPromptSubmission(prompt, context);
    expect(request.text).toBe(prompt.displayPrompt);
    expect(request.parameters).toEqual({ Customer: 'Latest' });
    expect(request.context).toEqual({
      gridId: context.gridId,
      selectedRowIds: [1, 2],
      filters: context.filters,
      sorting: context.sorting,
      summaries: context.summaries,
      selectedRowCount: 2,
      selectedRowIdsTruncated: false,
    });
    expect(request.context).not.toHaveProperty('parameterValues');
  });

  it('caps selected IDs at 20, preserves total count, and does not mutate context', () => {
    const context = {
      selectedRowIds: Array.from({ length: 30 }, (_, index) => index),
      selectedRowCount: 100,
    };
    const result = createPromptSubmission(
      { id: 'simple', displayPrompt: 'Summarize' },
      context
    );
    expect(result.context?.selectedRowIds).toHaveLength(20);
    expect(result.context?.selectedRowCount).toBe(100);
    expect(result.context?.selectedRowIdsTruncated).toBe(true);
    expect(context.selectedRowIds).toHaveLength(30);
  });

  it('formats the optional legacy text suffix and omits blank parameters', () => {
    expect(buildPromptMessage(' Summarize ', { a: '1', b: ' ' })).toBe(
      'Summarize\n\nParameters: a: 1'
    );
    expect(buildPromptMessage(' Summarize ')).toBe('Summarize');
  });

  it('rejects invalid prompt and parameter definitions explicitly', () => {
    expect(() => validatePrompts([prompt, prompt])).toThrow('Duplicate');
    expect(() => validatePrompts([{ id: '', displayPrompt: 'Text' }])).toThrow(
      'non-empty'
    );
    expect(() =>
      validatePrompts([
        {
          ...prompt,
          parameters: [
            { name: 'Customer', label: 'One' },
            { name: 'CUSTOMER', label: 'Two' },
          ],
        },
      ])
    ).toThrow('unique');
  });
});
