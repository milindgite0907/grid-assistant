import * as React from 'react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import type { Preview } from '@storybook/react-vite';

const preview: Preview = {
  decorators: [
    (Story) => <FluentProvider theme={webLightTheme}><Story /></FluentProvider>,
  ],
};

export default preview;
