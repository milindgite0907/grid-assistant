import { z } from 'zod';

export const statusSchema = z.enum(['Open', 'Shipped', 'On hold']);
export const regionSchema = z.enum(['North America', 'Europe', 'Asia Pacific']);
export const columnSchema = z.enum(['id', 'customer', 'status', 'region', 'amount']);
export const orderSchema = z.object({
  id: z.string(),
  customer: z.string(),
  status: statusSchema,
  region: regionSchema,
  amount: z.number().finite().nonnegative(),
});
export type Order = z.infer<typeof orderSchema>;
export const ordersSchema = z.array(orderSchema);

const parameterSchema = z.object({
  name: z.string(),
  label: z.string(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
});
export const promptsSchema = z.array(z.object({
  id: z.string(),
  displayPrompt: z.string(),
  shortPrompt: z.string().optional(),
  executePrompt: z.string().optional(),
  showInSparks: z.boolean().optional(),
  sparksGroup: z.string().optional(),
  parameters: z.array(parameterSchema).optional(),
  isGenerativeAI: z.boolean().optional(),
}));

export const filtersSchema = z.object({
  status: statusSchema.optional(),
  region: regionSchema.optional(),
  customerSearch: z.string().max(120).optional(),
}).strict();
export type GridFilters = z.infer<typeof filtersSchema>;

const contextSchema = z.object({
  gridId: z.literal('orders'),
  selectedRowIds: z.array(z.string().max(64)).max(20).default([]),
  selectedRowCount: z.number().int().min(0).max(1_000_000).optional(),
  selectedRowIdsTruncated: z.boolean().optional(),
  filters: filtersSchema.optional(),
  sorting: z.array(z.object({
    columnId: columnSchema,
    direction: z.enum(['ascending', 'descending']),
  }).strict()).max(1).optional(),
  summaries: z.record(z.union([
    z.string().max(200), z.number().finite(), z.boolean(), z.null(),
  ])).refine((value) => Object.keys(value).length <= 20, 'Too many summaries').optional(),
}).strict();

export const chatRequestSchema = z.object({
  promptId: z.string().trim().min(1).max(128),
  text: z.string().trim().min(1).max(4000),
  parameters: z.record(z.string().max(1000))
    .refine((value) => Object.keys(value).length <= 20, 'Too many parameters'),
  context: contextSchema,
}).strict();
export type ChatRequest = z.infer<typeof chatRequestSchema>;

const totalsSchema = z.object({
  rowCount: z.number(),
  amount: z.number(),
  openCount: z.number(),
  onHoldCount: z.number(),
  shippedCount: z.number(),
});
export const assistantContextSchema = z.object({
  gridId: z.literal('orders'),
  currency: z.literal('USD'),
  dataset: z.literal('Fictional local orders'),
  filters: filtersSchema,
  sorting: z.array(z.object({
    columnId: columnSchema,
    direction: z.enum(['ascending', 'descending']),
  })),
  selectedRowIds: z.array(z.string()),
  reportedSelectedCount: z.number(),
  selectionTruncated: z.boolean(),
  filtered: totalsSchema,
  includedSelection: totalsSchema,
});
export type AssistantContext = z.infer<typeof assistantContextSchema>;

export const healthSchema = z.object({
  status: z.literal('ok'),
  configured: z.boolean(),
  model: z.string().nullable(),
  provider: z.enum(['openai-compatible', 'json-http', 'demo']),
  providerHost: z.string().nullable(),
  missing: z.array(z.string()),
});
export type Health = z.infer<typeof healthSchema>;

export const rowSummaryRequestSchema = z.object({
  rowId: z.string().trim().min(1).max(64),
}).strict();
export type RowSummaryRequest = z.infer<typeof rowSummaryRequestSchema>;

// What the model must return. Providers differ; this JSON shape does not.
export const rowSummaryOutputSchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  highlights: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
});

export const rowSummaryResponseSchema = rowSummaryOutputSchema.extend({
  id: z.string(),
  rowId: z.string(),
  model: z.string(),
  warning: z.string().optional(),
});
export type RowSummaryResponse = z.infer<typeof rowSummaryResponseSchema>;

export const chatResponseSchema = z.object({
  id: z.string(),
  answer: z.string(),
  model: z.string(),
  context: assistantContextSchema,
  warning: z.string().optional(),
});
export type ChatResponse = z.infer<typeof chatResponseSchema>;

export const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
