import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../stories/index.stories.tsx'],
  core: { disableTelemetry: true },
};

export default config;
