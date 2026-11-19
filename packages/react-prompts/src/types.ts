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
