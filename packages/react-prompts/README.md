# @fluentui-contrib/react-prompts

Reusable Prompt Sparks and Prompt Gallery components for React and Fluent UI v9.
They collect a prompt, parameter values, and explicitly supplied context, then
call your application. They do not call an AI service, fetch grid data, or depend
on a chat implementation.

## Usage

```tsx
import { PromptSparksMenu } from '@fluentui-contrib/react-prompts';
import type { PromptDefinition } from '@fluentui-contrib/react-prompts';

const prompts: PromptDefinition[] = [
  {
    id: 'selection-summary',
    displayPrompt: 'Summarize the selected orders for {Audience}',
    shortPrompt: 'Summarize selection',
    showInSparks: true,
    sparksGroup: 'Orders',
    parameters: [{ name: 'Audience', label: 'Audience', required: true }],
  },
  {
    id: 'explain-filters',
    displayPrompt: 'Explain the active filters',
  },
];

// Render inside a FluentProvider. The application owns the assistant and grid state.
<PromptSparksMenu
  prompts={prompts}
  disabled={loading || isTyping}
  getContext={() => ({
    gridId: 'orders',
    selectedRowIds: Array.from(selectedItems),
    filters: { status: activeStatus },
    sorting: [{ columnId: 'amount', direction: 'descending' }],
    summaries: { selectedCount: selectedItems.size },
    parameterValues: { Audience: 'Operations team' },
  })}
  onSubmit={async (request) => {
    openChat();
    await sendToYourAssistant(request);
  }}
/>;
```

### Grid integration

Compose `PromptSparksMenu` in a `Toolbar` above a Fluent `DataGrid` or
`@fluentui-contrib/react-data-grid-react-window` grid. No new grid props or imports
inside the grid implementation are needed. See the [grid story](./stories/Grid.stories.tsx)
for controlled selection, filters, sorting, and computed summaries.

`getContext()` is synchronous and is called when opening a parameter form and
again when submitting. Return current application state, not a context object
captured before the user changed their selection.

Only explicitly supplied context is included:

- Grid identifier, selected IDs, filters, sorting, and scalar summaries.
- At most **20 selected IDs** per submission. `selectedRowCount` preserves the
  supplied total (or the original array length); `selectedRowIdsTruncated` signals
  omitted IDs.
- `parameterValues` prefills declared parameters. Fresh context defaults are
  merged at submission; explicit user edits, including clearing a field, win.
- Undeclared parameter values are excluded from `request.parameters`.

The context type deliberately has no rows property. This is not a security
boundary: the application must allowlist filter/summary fields, avoid sensitive
values, and enforce authorization in its backend. To answer questions about data
not present in summaries, the assistant backend must retrieve authorized records.
For server-paginated grids, IDs and metadata do not represent the entire dataset.

### Prompt data

Each definition requires a stable, unique `id` and non-empty `displayPrompt`.
Parameter names must be unique, case-insensitively, with non-empty names/labels.
Invalid definitions throw descriptive errors rather than silently disappearing.

`showInSparks: true` places a prompt in the grouped menu. Other prompts appear in
the gallery. A blank group becomes **Other**. A parameterized Sparks item opens
its parameter form instead of sending incomplete input.

The application loads only enabled prompts and adapts storage records to the
camelCase `PromptDefinition` contract. Parse and validate stored JSON at that
boundary, surfacing failures to the user.

### Gallery behavior

`PromptGalleryModal` can also be used directly with `open`, `prompts`, `onDismiss`,
`onSubmit`, optional `getContext`, and `disabled` props. It displays the prompts
passed to it; `PromptSparksMenu` performs Sparks/gallery partitioning.

- Search matches display, short, and execute text, case-insensitively.
- Mouse hover previews after **300 ms**; keyboard focus previews immediately.
- Click, Enter, or Space selects a card. Parameter forms use a portalled Fluent
  popover, so the scrollable card grid does not clip the form.
- Required parameters must contain non-whitespace text before sending.
- Preview substitutes `{Name}`, `{{Name}}`, and `[Name]`, case-insensitively.
  Empty values display `[Label]`. Submitted text remains the raw `displayPrompt`;
  `executePrompt` is searchable metadata and is never automatically sent.
- Closing unmounts the session and clears search, parameter values, and timers.
- External busy state and pending promises prevent duplicate sends. Submission
  and context errors are displayed; failed submissions keep the dialog open.
  Return a promise from `onSubmit` so the package can track completion/failure.
- A gallery opened by the menu returns focus to its trigger after closing.

### Submission contract

```ts
{
  promptId: string;
  text: string;
  parameters: Record<string, string>;
  context?: PromptContext;
}
```

Context is kept separate from prompt parameters; it is not concatenated into an
ambiguous string. The application decides how to present answers and connect an
assistant. Optional `buildPromptMessage(text, parameters)` produces the legacy
`text\n\nParameters: Name: value` format, but does not encode grid context.
Do not parse that format for values containing commas or newlines; prefer the
structured request.

## Development

This standalone repository uses npm workspaces. From the repository root:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run lint
npm.cmd test --workspace=@fluentui-contrib/react-prompts
npm.cmd run storybook
npx.cmd playwright install chromium
npm.cmd run test:components
npm.cmd run dev
```

`build` type-checks and emits JavaScript and declarations. The playground example
uses the local package's source through Vite, so edits hot-reload without packing
or reinstalling tarballs. See the [root guide](../../README.md) for the repository
layout and the [example guide](../../examples/playground/README.md) for AI setup.
