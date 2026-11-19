import type {
  PromptContext,
  PromptDefinition,
  PromptSubmission,
} from './types';

export function validatePrompts(prompts: readonly PromptDefinition[]): void {
  const ids = new Set<string>();
  for (const prompt of prompts) {
    if (!prompt.id.trim() || !prompt.displayPrompt.trim()) {
      throw new Error('Prompts must have a non-empty id and displayPrompt.');
    }
    if (ids.has(prompt.id)) {
      throw new Error(`Duplicate prompt id: ${prompt.id}`);
    }
    ids.add(prompt.id);

    const names = new Set<string>();
    for (const parameter of prompt.parameters ?? []) {
      const name = parameter.name.toLowerCase();
      if (!name.trim() || !parameter.label.trim() || names.has(name)) {
        throw new Error(
          `Prompt "${prompt.id}" must have unique, non-empty parameter names and labels.`
        );
      }
      names.add(name);
    }
  }
}

export function groupSparksPrompts(
  prompts: readonly PromptDefinition[]
): Map<string, PromptDefinition[]> {
  const groups = new Map<string, PromptDefinition[]>();
  for (const prompt of prompts) {
    if (prompt.showInSparks) {
      const group = prompt.sparksGroup?.trim() || 'Other';
      const entries = groups.get(group) ?? [];
      entries.push(prompt);
      groups.set(group, entries);
    }
  }
  return groups;
}

export function searchPrompts(
  prompts: readonly PromptDefinition[],
  search: string
): PromptDefinition[] {
  const query = search.trim().toLowerCase();
  return prompts.filter((prompt) =>
    [prompt.displayPrompt, prompt.shortPrompt, prompt.executePrompt].some(
      (text) => text?.toLowerCase().includes(query)
    )
  );
}

export function getParameterValues(
  prompt: PromptDefinition,
  context?: PromptContext,
  edits: Readonly<Record<string, string>> = {}
): Record<string, string> {
  const defaults = new Map(Object.entries(context?.parameterValues ?? {}));
  const entered = new Map(Object.entries(edits));
  return Object.fromEntries(
    (prompt.parameters ?? []).map(({ name }) => [
      name,
      entered.get(name) ?? defaults.get(name) ?? '',
    ])
  );
}

export function hasRequiredParameters(
  prompt: PromptDefinition,
  values: Readonly<Record<string, string>>
): boolean {
  const entered = new Map(Object.entries(values));
  return (prompt.parameters ?? []).every(
    ({ name, required }) => !required || !!entered.get(name)?.trim()
  );
}

export function formatPromptPreview(
  prompt: PromptDefinition,
  values: Readonly<Record<string, string>> = {}
): string {
  const entered = new Map(Object.entries(values));
  const parameters = new Map(
    (prompt.parameters ?? []).map((parameter) => [
      parameter.name.toLowerCase(),
      parameter,
    ])
  );
  // Match complete placeholders once, so values are never reinterpreted as templates.
  return prompt.displayPrompt.replace(
    /\{\{([^{}]+)\}\}|\{([^{}]+)\}|\[([^[\]]+)\]/g,
    (
      placeholder,
      double: string | undefined,
      single: string | undefined,
      square: string | undefined
    ) => {
      const parameter = parameters.get(
        (double ?? single ?? square ?? '').toLowerCase()
      );
      return parameter
        ? entered.get(parameter.name)?.trim() || `[${parameter.label}]`
        : placeholder;
    }
  );
}

export function createPromptSubmission(
  prompt: PromptDefinition,
  context?: PromptContext,
  edits: Readonly<Record<string, string>> = {}
): PromptSubmission {
  const values = getParameterValues(prompt, context, edits);
  if (!hasRequiredParameters(prompt, values)) {
    throw new Error('Complete all required prompt parameters.');
  }

  const selectedIds = context?.selectedRowIds;
  return {
    promptId: prompt.id,
    text: prompt.displayPrompt,
    parameters: Object.fromEntries(
      Object.entries(values).filter(([, value]) => value.trim() !== '')
    ),
    context: context
      ? {
          gridId: context.gridId,
          filters: context.filters,
          sorting: context.sorting,
          summaries: context.summaries,
          selectedRowCount: context.selectedRowCount,
          selectedRowIdsTruncated: context.selectedRowIdsTruncated,
          ...(selectedIds && {
            selectedRowIds: selectedIds.slice(0, 20),
            selectedRowCount: context.selectedRowCount ?? selectedIds.length,
            selectedRowIdsTruncated:
              !!context.selectedRowIdsTruncated || selectedIds.length > 20,
          }),
        }
      : undefined,
  };
}

/** Optional compatibility format; structured submission is preferred. */
export function buildPromptMessage(
  text: string,
  parameters: Readonly<Record<string, string>> = {}
): string {
  const suffix = Object.entries(parameters)
    .filter(([, value]) => value.trim() !== '')
    .map(([name, value]) => `${name}: ${value}`)
    .join(', ');
  return suffix ? `${text.trim()}\n\nParameters: ${suffix}` : text.trim();
}
