import type { RowSummary } from './types';

/** Markdown copy format, matching the row-summary experience in model-driven apps. */
export function rowSummaryToMarkdown(summary: Pick<RowSummary, 'summary' | 'highlights'>): string {
  const highlights = (summary.highlights ?? []).map((item) => item.trim()).filter(Boolean);
  return [
    summary.summary.trim(),
    ...(highlights.length ? ['', ...highlights.map((item) => `- ${item}`)] : []),
  ].join('\n');
}
