import * as React from 'react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import type { JSXElement } from '@fluentui/react-components';
import { PromptGalleryModal } from '../PromptGalleryModal/PromptGalleryModal';
import type { PromptDefinition, PromptSubmission } from '../../types';
import { Grid } from '../../../stories/Grid.stories';

const galleryPrompts: PromptDefinition[] = [
  ...Array.from({ length: 10 }, (_, index) => ({
    id: `simple-${index}`,
    displayPrompt: `Describe summary ${index}`,
  })),
  {
    id: 'parameters',
    displayPrompt: 'Analyze {Audience}',
    parameters: [{ name: 'Audience', label: 'Audience', required: true }],
  },
];

export function GalleryExample({
  contextError = false,
}: {
  contextError?: boolean;
}): JSXElement {
  const [open, setOpen] = React.useState(true);
  const [request, setRequest] = React.useState<PromptSubmission>();
  return (
    <FluentProvider theme={webLightTheme}>
      <PromptGalleryModal
        open={open}
        prompts={galleryPrompts}
        onDismiss={() => setOpen(false)}
        onSubmit={setRequest}
        getContext={() => {
          if (contextError) {
            throw new Error('Context unavailable');
          }
          return {};
        }}
      />
      <pre data-testid="request">{JSON.stringify(request)}</pre>
    </FluentProvider>
  );
}

export function GridExample(): JSXElement {
  return (
    <FluentProvider theme={webLightTheme}>
      <Grid />
    </FluentProvider>
  );
}
