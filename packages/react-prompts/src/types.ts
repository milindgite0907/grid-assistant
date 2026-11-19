export type PromptParameter = {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
};

export type PromptDefinition = {
  id: string;
  displayPrompt: string;
  shortPrompt?: string;
  executePrompt?: string;
  showInSparks?: boolean;
  sparksGroup?: string;
  parameters?: readonly PromptParameter[];
  isGenerativeAI?: boolean;
};

export type PromptContextValue =
  | string
  | number
  | boolean
  | null
  | readonly PromptContextValue[]
  | { readonly [key: string]: PromptContextValue };

/**
 * Explicitly supplied context only. The package never reads grid rows or calls
 * a data source. Selected IDs are capped at 20 when submitting.
 */
export type PromptContext = {
  gridId?: string;
  selectedRowIds?: readonly (string | number)[];
  selectedRowCount?: number;
  selectedRowIdsTruncated?: boolean;
  filters?: Readonly<Record<string, PromptContextValue>>;
  sorting?: readonly {
    columnId: string;
    direction: 'ascending' | 'descending';
  }[];
  summaries?: Readonly<Record<string, string | number | boolean | null>>;
  /** Initial values for declared parameters; user edits take precedence. */
  parameterValues?: Readonly<Record<string, string>>;
};

export type PromptSubmission = {
  promptId: string;
  text: string;
  parameters: Record<string, string>;
  context?: Omit<PromptContext, 'parameterValues'>;
};

export type PromptSubmissionOptions = {
  disabled?: boolean;
  getContext?: () => PromptContext;
  onSubmit: (request: PromptSubmission) => void | Promise<void>;
};

export type PromptSparksMenuProps = PromptSubmissionOptions & {
  prompts: readonly PromptDefinition[];
  label?: string;
};

export type PromptGalleryModalProps = PromptSubmissionOptions & {
  open: boolean;
  prompts: readonly PromptDefinition[];
  onDismiss: () => void;
};

/** Provider-neutral summary of one row: a short paragraph plus optional bullets. */
export type RowSummary = {
  summary: string;
  highlights?: readonly string[];
  model?: string;
  warning?: string;
};

export type RowSummaryFeedback = 'positive' | 'negative';

export type RowSummaryDialogProps = {
  open: boolean;
  /** Names the summarized row, for example "Order order-001". */
  title: string;
  /** Called on open and on Refresh. The application owns the AI call; abort the request when `signal` aborts. */
  loadSummary: (signal: AbortSignal) => Promise<RowSummary>;
  onDismiss: () => void;
  onFeedback?: (feedback: RowSummaryFeedback, summary: RowSummary) => void;
};
