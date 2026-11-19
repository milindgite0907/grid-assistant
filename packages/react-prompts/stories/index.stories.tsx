import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { JSXElement } from '@fluentui/react-components';
import { PromptSparksMenu } from '../src';
import type { PromptSubmission } from '../src';
import { prompts } from './prompts';

export { Grid } from './Grid.stories';

export function Default(): JSXElement {
  const [request, setRequest] = React.useState<PromptSubmission>();
  return (
    <>
      <PromptSparksMenu prompts={prompts} onSubmit={setRequest} />
      <pre aria-label="Submitted request">
        {request
          ? JSON.stringify(request, null, 2)
          : 'No prompt submitted yet.'}
      </pre>
    </>
  );
}

const meta = {
  title: 'Packages/react-prompts',
  component: PromptSparksMenu,
  parameters: {
    docs: {
      description: {
        component:
          'Provider-independent prompt discovery with structured context. The grid example displays requests; it does not call an AI service.',
      },
    },
  },
} satisfies Meta<typeof PromptSparksMenu>;

export default meta;
