import { rowSummaryToMarkdown } from './rowSummary';

describe('rowSummaryToMarkdown', () => {
  it('copies a paragraph followed by bullet points', () => {
    expect(rowSummaryToMarkdown({ summary: ' Open order. ', highlights: ['Large amount', ' ', 'On hold soon'] }))
      .toBe('Open order.\n\n- Large amount\n- On hold soon');
  });

  it('omits the bullet block when there are no highlights', () => {
    expect(rowSummaryToMarkdown({ summary: 'Only text.' })).toBe('Only text.');
  });
});
